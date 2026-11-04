import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { users } from "../lib/db/schema";
import { createTestDb, type TestDb } from "./helpers/test-db";

let ctx: TestDb;
let attemptsModule: typeof import("../lib/attempts");
let adminModule: typeof import("../lib/admin");

let user1: typeof users.$inferSelect;
let user2: typeof users.$inferSelect;

beforeAll(async () => {
  ctx = await createTestDb();
  attemptsModule = await import("../lib/attempts");
  adminModule = await import("../lib/admin");

  const all = await ctx.db.select().from(users).all();
  user1 = all.find((row) => row.username === "user1")!;
  user2 = all.find((row) => row.username === "user2")!;

  const attemptId = await attemptsModule.createFullMock(user1.id);
  const bundle = await attemptsModule.getAttemptBundle(attemptId, user1);
  if (!bundle || bundle.questions.length === 0) {
    throw new Error("Seeded question bank is empty");
  }

  const first = bundle.questions[0]!;
  const rest = bundle.questions.slice(1, 6).map((question) => ({
    questionId: question.id,
    selectedIndex: question.correctIndex ?? 0,
  }));

  await attemptsModule.saveAnswers(attemptId, user1, [
    {
      questionId: first.id,
      selectedIndex: first.correctIndex === null ? 0 : (first.correctIndex + 1) % 4,
    },
    ...rest,
  ]);

  const submitted = await attemptsModule.submitAttempt(attemptId, user1);
  if (!submitted.ok) throw new Error("Could not submit the fixture attempt");
}, 60_000);

afterAll(async () => {
  await ctx?.close();
});

describe("admin overview", () => {
  it("reports every account, including ones with no activity", async () => {
    const overview = await adminModule.getAdminOverview();

    expect(overview.totals.users).toBe(6);
    expect(overview.totals.candidates).toBe(5);
    expect(overview.totals.scoredAttempts).toBe(1);
    expect(overview.totals.inProgress).toBe(0);

    const one = overview.users.find((row) => row.id === user1.id)!;
    expect(one.attempts).toBe(1);
    expect(one.scored).toBe(1);
    expect(one.bestNet).not.toBeNull();
    expect(one.averageNet).not.toBeNull();
    expect(one.latestNet).not.toBeNull();
    expect(one.lastActive).not.toBeNull();
    expect(one.weakestSection).not.toBeNull();

    const two = overview.users.find((row) => row.id === user2.id)!;
    expect(two.attempts).toBe(0);
    expect(two.scored).toBe(0);
    expect(two.bestNet).toBeNull();
    expect(two.lastActive).toBeNull();
  });
});

describe("admin user detail", () => {
  it("returns attempts, mastery and trend for one account", async () => {
    const detail = await adminModule.getAdminUserDetail(user1.id);
    expect(detail).not.toBeNull();
    if (!detail) return;

    expect(detail.attemptCount).toBe(1);
    expect(detail.scoredCount).toBe(1);
    expect(detail.attempts).toHaveLength(1);
    expect(detail.mastery.length).toBeGreaterThan(0);
    expect(detail.trend).toHaveLength(1);
    expect(detail.byKind.map((row) => row.kind)).toContain("full");
    expect(detail.mistakes).toBeGreaterThanOrEqual(1);
    expect(detail.averageNet).not.toBeNull();
  });

  it("returns an empty-but-valid report for an inactive candidate", async () => {
    const detail = await adminModule.getAdminUserDetail(user2.id);
    expect(detail).not.toBeNull();
    if (!detail) return;

    expect(detail.attemptCount).toBe(0);
    expect(detail.scoredCount).toBe(0);
    expect(detail.attempts).toEqual([]);
    expect(detail.mastery).toEqual([]);
    expect(detail.bestNet).toBeNull();
    expect(detail.accuracy).toBe(0);
  });

  it("returns null for an unknown id", async () => {
    await expect(adminModule.getAdminUserDetail("does-not-exist")).resolves.toBeNull();
  });
});
