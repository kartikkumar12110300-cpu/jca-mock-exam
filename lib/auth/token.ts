import { SignJWT, jwtVerify } from "jose";
import { authSecret } from "@/lib/env";
import type { Role } from "@/lib/db/types";

export const SESSION_COOKIE = "jca_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7;
const ISSUER = "jca-mock-exam";
const AUDIENCE = "jca-web";

export interface SessionPayload {
  sub: string;
  username: string;
  role: Role;
  displayName: string;
  /** Matches UserDoc.tokenVersion; a mismatch invalidates the session. */
  ver: number;
}

function secret(): Uint8Array {
  return new TextEncoder().encode(authSecret());
}

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({
    username: payload.username,
    role: payload.role,
    displayName: payload.displayName,
    ver: payload.ver,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(secret());
}

export async function verifySessionToken(
  token: string | undefined,
): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), {
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    if (
      typeof payload.sub !== "string" ||
      typeof payload.username !== "string" ||
      typeof payload.displayName !== "string" ||
      (payload.role !== "user" && payload.role !== "admin")
    ) {
      return null;
    }
    return {
      sub: payload.sub,
      username: payload.username,
      role: payload.role,
      displayName: payload.displayName,
      // Older tokens (minted before this field existed) map to version 0.
      ver: typeof payload.ver === "number" ? payload.ver : 0,
    };
  } catch {
    return null;
  }
}
