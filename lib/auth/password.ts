/**
 * Password hashing.
 *
 * scrypt is built into Node, so multi-user auth needs no native dependency
 * (important for Vercel) and no plaintext passwords anywhere.
 *
 * Stored format: `scrypt:<salt-hex>:<key-hex>`
 */
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;
const SALT_BYTES = 16;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES).toString("hex");
  const key = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
  return `scrypt:${salt}:${key.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(":");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;

  const [, salt, expectedHex] = parts;
  let expected: Buffer;
  try {
    expected = Buffer.from(expectedHex, "hex");
  } catch {
    return false;
  }
  if (expected.length !== KEY_LENGTH) return false;

  const actual = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
  return timingSafeEqual(actual, expected);
}

/**
 * Used when a username does not exist, so a failed login takes the same time
 * whether or not the account is real.
 */
export const DUMMY_PASSWORD_HASH =
  "scrypt:00000000000000000000000000000000:" +
  "0".repeat(KEY_LENGTH * 2);
