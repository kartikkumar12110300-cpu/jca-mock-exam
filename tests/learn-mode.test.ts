import { describe, expect, it } from "vitest";
import {
  LEARN_COUNTS,
  LEARN_MAX_QUESTIONS,
  LEARN_PAGE_SIZE,
  LEARN_WINDOW_SEC,
} from "@/lib/exam/pattern";
import { createAttemptSchema } from "@/lib/validation/schemas";

describe("learn mode", () => {
  it("uses 10-question pages and a 30-day resume window", () => {
    expect(LEARN_PAGE_SIZE).toBe(10);
    expect(LEARN_WINDOW_SEC).toBe(30 * 24 * 60 * 60);
    expect(LEARN_COUNTS.every((count) => count % LEARN_PAGE_SIZE === 0)).toBe(true);
  });

  it("caps a session at the maximum question count", () => {
    expect(LEARN_MAX_QUESTIONS).toBe(50);
    expect(LEARN_COUNTS.every((count) => count <= LEARN_MAX_QUESTIONS)).toBe(true);
  });

  it("accepts a learn request with or without a section", () => {
    expect(createAttemptSchema.safeParse({ kind: "learn" }).success).toBe(true);
    expect(
      createAttemptSchema.safeParse({ kind: "learn", sectionId: "english", count: 20 }).success,
    ).toBe(true);
  });

  it("rejects an unknown section or an oversized session", () => {
    expect(
      createAttemptSchema.safeParse({ kind: "learn", sectionId: "nope" }).success,
    ).toBe(false);
    expect(
      createAttemptSchema.safeParse({ kind: "learn", count: LEARN_MAX_QUESTIONS + 1 }).success,
    ).toBe(false);
  });
});
