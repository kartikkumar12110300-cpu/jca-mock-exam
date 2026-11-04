import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gt } from "drizzle-orm";
import { db, dbReady } from "../db";
import { sessions, users, type Role } from "../db/schema";
import { hashSessionToken, newSessionToken } from "./token";

/**
 * Cookie holds a random 256-bit token; the database stores only its sha256.
 * That way a leaked database does not hand out live sessions, and logout or
 * deactivation revokes access immediately.
 */
export const SESSION_COOKIE = "jca_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface SessionUser {
  id: string;
  username: string;
  displayName: string;
  role: Role;
}

function cookieOptions(expires: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  };
}

/** Only callable from a Route Handler or Server Action. */
export async function createSession(userId: string): Promise<void> {
  await dbReady;

  const token = newSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await db
    .insert(sessions)
    .values({
      id: crypto.randomUUID(),
      userId,
      tokenHash: hashSessionToken(token),
      expiresAt,
    })
    .run();

  const store = await cookies();
  store.set(SESSION_COOKIE, token, cookieOptions(expiresAt));
}

/** Only callable from a Route Handler or Server Action. */
export async function destroySession(): Promise<void> {
  await dbReady;

  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;

  if (token) {
    await db.delete(sessions).where(eq(sessions.tokenHash, hashSessionToken(token))).run();
  }

  store.delete(SESSION_COOKIE);
}

/**
 * Resolve the signed-in user for the current request. Wrapped in React `cache`
 * so a layout, page and header share one query.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  await dbReady;

  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const row = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      role: users.role,
      isActive: users.isActive,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(
      and(eq(sessions.tokenHash, hashSessionToken(token)), gt(sessions.expiresAt, new Date())),
    )
    .get();

  if (!row || !row.isActive) return null;

  return {
    id: row.id,
    username: row.username,
    displayName: row.displayName,
    role: row.role,
  };
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/");
  return user;
}
