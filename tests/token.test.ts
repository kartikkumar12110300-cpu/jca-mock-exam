import { describe, expect, it } from "vitest";
import { hashSessionToken, newSessionToken } from "../lib/auth/token";

describe("session tokens", () => {
  it("generates a new token every time", () => {
    const a = newSessionToken();
    const b = newSessionToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(40);
  });

  it("hashes deterministically to a sha256 hex digest", () => {
    const token = "fixed-token";
    const hashed = hashSessionToken(token);
    expect(hashed).toBe(hashSessionToken(token));
    expect(hashed).toMatch(/^[0-9a-f]{64}$/);
  });

  it("does not store the raw token", () => {
    const token = newSessionToken();
    expect(hashSessionToken(token)).not.toBe(token);
    expect(hashSessionToken(token)).not.toContain(token);
  });
});
