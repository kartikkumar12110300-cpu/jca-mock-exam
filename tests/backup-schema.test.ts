import { describe, expect, it } from "vitest";
import { backupSchema, restoreModeSchema } from "@/lib/backup";

const valid = {
  version: 1,
  exportedAt: new Date().toISOString(),
  tests: [
    {
      title: "Full mock",
      kind: "full",
      pattern: {},
      durationSec: 5400,
      questionIds: ["q1", "q2"],
      isTemplate: false,
      createdAt: new Date().toISOString(),
    },
  ],
  attempts: [
    {
      testIndex: 0,
      startedAt: new Date().toISOString(),
      endsAt: new Date(Date.now() + 5400_000).toISOString(),
      submittedAt: null,
      status: "in_progress",
      score: null,
      createdAt: new Date().toISOString(),
    },
  ],
  answers: [
    {
      attemptIndex: 0,
      questionId: "q1",
      selectedIndex: 2,
      isCorrect: true,
      markedForReview: false,
      timeSpentMs: 4200,
      updatedAt: new Date().toISOString(),
    },
  ],
};

describe("backup schema", () => {
  it("accepts a valid backup payload", () => {
    const parsed = backupSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
  });

  it("rejects an unsupported version", () => {
    const parsed = backupSchema.safeParse({ ...valid, version: 2 });
    expect(parsed.success).toBe(false);
  });

  it("rejects an out-of-range selected option", () => {
    const parsed = backupSchema.safeParse({
      ...valid,
      answers: [{ ...valid.answers[0], selectedIndex: 9 }],
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects a missing exportedAt", () => {
    const { exportedAt: _ignored, ...rest } = valid;
    void _ignored;
    expect(backupSchema.safeParse(rest).success).toBe(false);
  });

  it("accepts learn sessions in a backup", () => {
    const parsed = backupSchema.safeParse({
      ...valid,
      tests: [{ ...valid.tests[0], kind: "learn" }],
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts only the two documented restore modes", () => {
    expect(restoreModeSchema.safeParse("merge").success).toBe(true);
    expect(restoreModeSchema.safeParse("replace").success).toBe(true);
    expect(restoreModeSchema.safeParse("overwrite").success).toBe(false);
  });
});
