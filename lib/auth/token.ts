import { createHash, randomBytes } from "node:crypto";

/**
 * Session tokens.
 *
 * The cookie carries a 256-bit random value; the database only ever stores its
 * sha256. A leaked database therefore contains no usable session tokens.
 */

export function newSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
