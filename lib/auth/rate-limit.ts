import { eq, lt } from "drizzle-orm";
import { db, dbReady } from "../db";
import { loginAttempts } from "../db/schema";

/**
 * DB-backed login throttling. In-memory counters do not survive serverless
 * cold starts, so the window is stored next to the accounts.
 */
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const MAX_LOGIN_FAILURES = 5;
const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

export interface LoginGate {
  allowed: boolean;
  retryAfterSec: number;
}

export function loginAttemptKey(username: string, ip: string): string {
  return `${username.trim().toLowerCase()}|${ip}`;
}

export async function checkLoginAllowed(key: string): Promise<LoginGate> {
  await dbReady;

  const row = await db
    .select()
    .from(loginAttempts)
    .where(eq(loginAttempts.key, key))
    .get();

  if (!row) return { allowed: true, retryAfterSec: 0 };

  const age = Date.now() - row.windowStart.getTime();
  if (age >= LOGIN_WINDOW_MS) return { allowed: true, retryAfterSec: 0 };
  if (row.failures < MAX_LOGIN_FAILURES) return { allowed: true, retryAfterSec: 0 };

  return {
    allowed: false,
    retryAfterSec: Math.max(1, Math.ceil((LOGIN_WINDOW_MS - age) / 1000)),
  };
}

export async function recordLoginFailure(key: string): Promise<void> {
  await dbReady;

  const now = new Date();

  await db.transaction(async (tx) => {
    const row = await tx
      .select()
      .from(loginAttempts)
      .where(eq(loginAttempts.key, key))
      .get();

    const expired =
      !row || now.getTime() - row.windowStart.getTime() >= LOGIN_WINDOW_MS;

    if (expired) {
      await tx
        .insert(loginAttempts)
        .values({ key, failures: 1, windowStart: now, updatedAt: now })
        .onConflictDoUpdate({
          target: loginAttempts.key,
          set: { failures: 1, windowStart: now, updatedAt: now },
        })
        .run();
      return;
    }

    await tx
      .update(loginAttempts)
      .set({ failures: row.failures + 1, updatedAt: now })
      .where(eq(loginAttempts.key, key))
      .run();
  });

  // Opportunistic cleanup so the table never grows without bound.
  await db
    .delete(loginAttempts)
    .where(lt(loginAttempts.updatedAt, new Date(now.getTime() - STALE_AFTER_MS)))
    .run();
}

export async function clearLoginFailures(key: string): Promise<void> {
  await dbReady;
  await db.delete(loginAttempts).where(eq(loginAttempts.key, key)).run();
}

/** First hop of the proxy chain, with a stable local fallback. */
export function requestIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return request.headers.get("x-real-ip")?.trim() || "local";
}
