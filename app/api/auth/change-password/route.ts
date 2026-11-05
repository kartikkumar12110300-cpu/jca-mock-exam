import { getApiUser } from "@/lib/auth/guards";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  createSessionToken,
} from "@/lib/auth/token";
import { users } from "@/lib/db/collections";
import { cookieSecure } from "@/lib/env";
import { failure, json, serverFailure } from "@/lib/http";
import { parseBody } from "@/lib/validation/parse";
import { changePasswordSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const current = await getApiUser();
    if (!current) return failure("Authentication required", 401);

    const parsed = await parseBody(request, changePasswordSchema);
    if (!parsed.ok) return parsed.response;

    const user = await (await users()).findOne({ _id: current.id });
    if (!user) return failure("Account not found", 404);

    const valid = await verifyPassword(parsed.data.currentPassword, user.passwordHash);
    if (!valid) return failure("Current password is incorrect", 401);

    if (parsed.data.currentPassword === parsed.data.newPassword) {
      return failure("Choose a password you have not used here before.", 422);
    }

    const passwordHash = await hashPassword(parsed.data.newPassword);
    const tokenVersion = (user.tokenVersion ?? 0) + 1;

    await (await users()).updateOne(
      { _id: user._id },
      {
        $set: {
          passwordHash,
          tokenVersion,
          mustChangePassword: false,
        },
      },
    );

    // Revoke every older token and re-issue one for this browser, so the user
    // stays signed in here but is signed out everywhere else.
    const token = await createSessionToken({
      sub: user._id,
      username: user.username,
      role: user.role,
      displayName: user.displayName,
      ver: tokenVersion,
    });

    const response = json({ ok: true });
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
