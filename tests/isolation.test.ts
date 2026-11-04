import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { users } from "../lib/db/schema";
import { canReadUser } from "../lib/auth/types";
import { createTestDb, type TestDb } from "./helpers/test-db";

let ctx: TestDb;
let attemptsModule: typeof import("../lib/attempts");
let statsModule: typeof import("../lib/stats");
let resetModule: typeof import("../lib/reset");
let rateLimitModule: typeof import("../lib/auth/rate-limit");

let user1: typeof users.$inferSelect;
let user2: typeof users.$inferSelect;
let admin: typeof users.$inferSelect;
let attempt1: string;
let attempt2: string;

beforeAll(async () => {
  ctx = await createTestDb();

  attemptsModule = await import("../lib/attempts");
  statsModule = await import("../lib/stats");
  resetModule = await import("../lib/reset");
  rateLimitModule = await import("../lib/auth/rate-limit");

  const all = await ctx.db.select().from(users).all();
  user1 = all.find((row) => row.username === "user1")!;
  user2 = all.find((row) => row.username === "user2")!;
  admin = all.find((row) => row.username === "admin")!;

  if (!user1 || !user2 || !admin) {
    throw new Error("Seeded accounts are missing");
  }

  attempt1 = await attemptsModule.createFullMock(user1.id);
  attempt2 = await attemptsModule.createFullMock(user2.id);
}, 60_000);

afterAll(async () => {
  await ctx?.close();
});

describe("seeded accounts", () => {
  it("creates five candidates and one admin with hashed passwords", async () => {
    const all = await ctx.db.select().from(users).all();
    expect(all).toHaveLength(6);
    expect(all.filter((row) => row.role === "user")).toHaveLength(5);
    expect(all.filter((row) => row.role === "admin")).toHaveLength(1);

    for (const row of all) {
      expect(row.passwordHash.startsWith("scrypt:")).toBe(true);
      expect(row.passwordHash).not.toContain("test");
      expect(row.passwordHash).not.toBe("admin");
    }
  });
});

describe("read authorization", () => {
  it("lets the owner read a paper", async () => {
    const bundle = await attemptsModule.getAttemptBundle(attempt1, user1);
    expect(bundle).not.toBeNull();
    expect(bundle?.attempt.userId).toBe(user1.id);
  });

  it("hides another candidate's paper", async () => {
    const bundle = await attemptsModule.getAttemptBundle(attempt1, user2);
    expect(bundle).toBeNull();
  });

  it("lets an administrator read a paper for monitoring", async () => {
    const bundle = await attemptsModule.getAttemptBundle(attempt1, admin);
    expect(bundle).not.toBeNull();
    expect(bundle?.attempt.userId).toBe(user1.id);
  });

  it("keeps the viewer helper honest", () => {
    expect(canReadUser({ id: user1.id, role: "user" }, user1.id)).toBe(true);
    expect(canReadUser({ id: user2.id, role: "user" }, user1.id)).toBe(false);
    expect(canReadUser({ id: admin.id, role: "admin" }, user1.id)).toBe(true);
  });
});

describe("write authorization", () => {
  it("refuses another candidate's autosave", async () => {
    const bundle = await attemptsModule.getAttemptBundle(attempt1, user1);
    const answers = (bundle?.questions ?? []).slice(0, 3).map((question) => ({
      questionId: question.id,
      selectedIndex: 0,
    }));

    const result = await attemptsModule.saveAnswers(attempt1, user2, answers);
    expect(result.ok).toBe(false);
  });

  it("refuses an administrator's write, even though reads are allowed", async () => {
    const bundle = await attemptsModule.getAttemptBundle(attempt1, user1);
    const answers = (bundle?.questions ?? []).slice(0, 3).map((question) => ({
      questionId: question.id,
      selectedIndex: 0,
    }));

    const result = await attemptsModule.saveAnswers(attempt1, admin, answers);
    expect(result.ok).toBe(false);
  });

  it("accepts the owner's autosave", async () => {
    const bundle = await attemptsModule.getAttemptBundle(attempt1, user1);
    const first = bundle?.questions[0];
    expect(first).toBeDefined();

    const result = await attemptsModule.saveAnswers(attempt1, user1, [
      { questionId: first!.id, selectedIndex: first!.correctIndex ?? 0 },
    ]);
    expect(result.ok).toBe(true);
  });

  it("refuses another candidate's submit but submits once for the owner", async () => {
    const denied = await attemptsModule.submitAttempt(attempt1, user2);
    expect(denied.ok).toBe(false);

    const result = await attemptsModule.submitAttempt(attempt1, user1);
    expect(result.ok).toBe(true);

    const again = await attemptsModule.submitAttempt(attempt1, user1);
    expect(again.ok).toBe(true);
    if (!result.ok || !again.ok) return;
    expect(again.score.net).toBe(result.score.net);
  });
});

describe("stat scoping", () => {
  it("lists only the viewer's attempts", async () => {
    const mine = await statsModule.listAttempts(user1.id, 200);
    expect(mine.map((row) => row.id)).toEqual([attempt1]);

    const theirs = await statsModule.listAttempts(user2.id, 200);
    expect(theirs.map((row) => row.id)).toEqual([attempt2]);
  });

  it("scopes section mastery to one user", async () => {
    const mastery = await statsModule.sectionMastery(user1.id);
    expect(Array.isArray(mastery)).toBe(true);
    // user2 has not submitted anything, so there is no mastery to report.
    await expect(statsModule.sectionMastery(user2.id)).resolves.toEqual([]);
  });
});

describe("clearing history", () => {
  it("clears only the requested user's attempts", async () => {
    const report = await resetModule.clearAttempts(user1.id);
    expect(report.attempts).toBe(1);

    expect(await attemptsModule.getAttemptBundle(attempt1, user1)).toBeNull();
    expect(await attemptsModule.getAttemptBundle(attempt2, user2)).not.toBeNull();
  });
});

describe("login throttling", () => {
  it("blocks after five failures and clears on success", async () => {
    const key = rateLimitModule.loginAttemptKey("user1", "203.0.113.7");

    for (let i = 0; i < rateLimitModule.MAX_LOGIN_FAILURES; i += 1) {
      await rateLimitModule.recordLoginFailure(key);
    }

    const blocked = await rateLimitModule.checkLoginAllowed(key);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);

    await rateLimitModule.clearLoginFailures(key);
    const allowed = await rateLimitModule.checkLoginAllowed(key);
    expect(allowed.allowed).toBe(true);
  });

  it("separates usernames and IPs", async () => {
    const a = rateLimitModule.loginAttemptKey("user1", "203.0.113.7");
    const b = rateLimitModule.loginAttemptKey("user2", "203.0.113.7");
    const c = rateLimitModule.loginAttemptKey("user1", "203.0.113.8");
    expect(new Set([a, b, c]).size).toBe(3);
  });
});
