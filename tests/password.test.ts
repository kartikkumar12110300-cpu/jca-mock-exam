import { describe, expect, it } from "vitest";
import { DUMMY_PASSWORD_HASH, hashPassword, verifyPassword } from "../lib/auth/password";

describe("password hashing", () => {
  it("round-trips the same password", async () => {
    const stored = await hashPassword("test1");
    await expect(verifyPassword("test1", stored)).resolves.toBe(true);
  });

  it("rejects a wrong password", async () => {
    const stored = await hashPassword("test1");
    await expect(verifyPassword("test2", stored)).resolves.toBe(false);
  });

  it("salts every hash", async () => {
    const a = await hashPassword("same-password");
    const b = await hashPassword("same-password");
    expect(a).not.toBe(b);
    expect(a.startsWith("scrypt:")).toBe(true);
    await expect(verifyPassword("same-password", a)).resolves.toBe(true);
    await expect(verifyPassword("same-password", b)).resolves.toBe(true);
  });

  it("stores nothing that looks like the plaintext", async () => {
    const stored = await hashPassword("super-secret");
    expect(stored).not.toContain("super-secret");
  });

  it("rejects malformed hashes instead of throwing", async () => {
    for (const bad of ["", "plaintext", "scrypt:only-two", "bcrypt:aa:bb", "scrypt:zz:zz"]) {
      await expect(verifyPassword("anything", bad)).resolves.toBe(false);
    }
  });

  it("never accepts the dummy timing hash", async () => {
    await expect(verifyPassword("", DUMMY_PASSWORD_HASH)).resolves.toBe(false);
    await expect(verifyPassword("admin", DUMMY_PASSWORD_HASH)).resolves.toBe(false);
  });
});
