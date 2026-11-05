import { verifyPassword } from "@/lib/auth/password";
import {
  MAX_IP_ATTEMPTS,
  clearLoginFailures,
  isLoginBlocked,
  recordLoginFailure,
} from "@/lib/auth/rate-limit";
import { SESSION_COOKIE, SESSION_MAX_AGE, createSessionToken } from "@/lib/auth/token";
import { users } from "@/lib/db/collections";
import { cookieSecure } from "@/lib/env";
import { clientIp, failure, json, serverFailure } from "@/lib/http";
import { parseBody } from "@/lib/validation/parse";
import { loginSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

/**
 * A valid bcrypt hash that never matches. Comparing against it when the user
 * does not exist keeps the response time similar and avoids an enumeration
 * oracle.
 */
const DUMMY_HASH = "$2b$12$mWQfgpsN7nFCeoLod49FJuj5jwN10a.xdYmN0Vp1OU3hHN9kx6FfC";

export async function POST(request: Request) {
  try {
    const parsed = await parseBody(request, loginSchema);
    if (!parsed.ok) return parsed.response;

    const username = parsed.data.username.toLowerCase();
    const ip = clientIp(request);
    const userKey = `user:${ip}:${username}`;
    const ipKey = `ip:${ip}`;

    const [userBlocked, ipBlocked] = await Promise.all([
      isLoginBlocked(userKey),
      isLoginBlocked(ipKey, MAX_IP_ATTEMPTS),
    ]);
    if (userBlocked || ipBlocked) {
      return failure("Too many login attempts. Try again in 15 minutes.", 429);
    }

    const user = await (await users()).findOne({ username });
    const valid = await verifyPassword(
      parsed.data.password,
      user?.active ? user.passwordHash : DUMMY_HASH,
    );

    if (!user || !user.active || !valid) {
      await Promise.all([
        recordLoginFailure(userKey),
        recordLoginFailure(ipKey),
      ]);
      return failure("Invalid username or password", 401);
    }

    await clearLoginFailures(userKey);
    await (await users()).updateOne(
      { _id: user._id },
      { $set: { lastLoginAt: new Date() } },
    );

    const token = await createSessionToken({
      sub: user._id,
      username: user.username,
      role: user.role,
      displayName: user.displayName,
      ver: user.tokenVersion ?? 0,
    });

    const response = json({
      ok: true,
      user: {
        id: user._id,
        username: user.username,
        displayName: user.displayName,
        role: user.role,
        mustChangePassword: Boolean(user.mustChangePassword),
      },
    });

    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: cookieSecure(),
      path: "/",
      maxAge: SESSION_MAX_AGE,
    });

    return response;
  } catch (error) {
    return serverFailure(error);
  }
}
