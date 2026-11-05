import { describe, expect, it } from "vitest";
import { createSessionToken, verifySessionToken } from "@/lib/auth/token";

const payload = {
  sub: "user-1",
  username: "user1",
  role: "user" as const,
  displayName: "User 1",
  ver: 0,
};

describe("session tokens", () => {
  it("round-trips a user payload", async () => {
    const token = await createSessionToken(payload);
    const session = await verifySessionToken(token);

    expect(session).toEqual(payload);
  });

  it("rejects a missing token", async () => {
    expect(await verifySessionToken(undefined)).toBeNull();
  });

  it("rejects a tampered token", async () => {
    const token = await createSessionToken(payload);
    expect(await verifySessionToken(`${token}x`)).toBeNull();
  });

  it("rejects a token signed with a different secret", async () => {
    const { SignJWT } = await import("jose");
    const token = await new SignJWT({
      username: "user1",
      role: "user",
      displayName: "User 1",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("user-1")
      .setIssuer("jca-mock-exam")
      .setAudience("jca-web")
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode("a-different-secret-that-is-long-enough"));

    expect(await verifySessionToken(token)).toBeNull();
  });
});
