import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, dbReady } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { DUMMY_PASSWORD_HASH, verifyPassword } from "@/lib/auth/password";
import {
  checkLoginAllowed,
  clearLoginFailures,
  loginAttemptKey,
  recordLoginFailure,
  requestIp,
} from "@/lib/auth/rate-limit";
import { createSession } from "@/lib/auth/session";
import { loginSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  await dbReady;

  const json = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Enter a username and password." },
      { status: 400 },
    );
  }

  const username = parsed.data.username.toLowerCase();
  const key = loginAttemptKey(username, requestIp(request));

  const gate = await checkLoginAllowed(key);
  if (!gate.allowed) {
    return NextResponse.json(
      {
        ok: false,
        error: `Too many failed attempts. Try again in ${Math.ceil(gate.retryAfterSec / 60)} minute(s).`,
      },
      { status: 429, headers: { "retry-after": String(gate.retryAfterSec) } },
    );
  }

  const user = await db.select().from(users).where(eq(users.username, username)).get();

  // Always run scrypt so a missing username is indistinguishable by timing.
  const passwordOk = await verifyPassword(
    parsed.data.password,
    user?.passwordHash ?? DUMMY_PASSWORD_HASH,
  );

  if (!user || !user.isActive || !passwordOk) {
    await recordLoginFailure(key);
    return NextResponse.json(
      { ok: false, error: "Invalid username or password." },
      { status: 401 },
    );
  }

  await clearLoginFailures(key);
  await createSession(user.id);

  const home = user.role === "admin" ? "/admin" : "/";
  const requested = parsed.data.next;
  const redirectTo =
    requested && requested.startsWith("/") && !requested.startsWith("//") ? requested : home;

  return NextResponse.json({
    ok: true,
    redirectTo,
    user: { username: user.username, role: user.role },
  });
}
