import { describe, expect, it } from "vitest";
import { drillWeight, mockWeight, RECENT_MS, UNSEEN_WEIGHT } from "./selection";
import type { QuestionStat } from "./stats";

const NOW = 1_700_000_000_000;
const OLD = NOW - RECENT_MS - 1;

function stat(over: Partial<QuestionStat> = {}): QuestionStat {
  return {
    questionId: "q",
    sectionId: "english",
    attempts: 1,
    correct: 0,
    wrong: 0,
    skipped: 0,
    lastSeen: OLD,
    ...over,
  };
}

describe("mockWeight", () => {
  it("gives unseen questions the full unseen weight", () => {
    expect(mockWeight(undefined, NOW)).toBe(UNSEEN_WEIGHT);
    expect(mockWeight(stat({ attempts: 0 }), NOW)).toBe(UNSEEN_WEIGHT);
  });

  it("prefers a question answered wrong over one answered right", () => {
    const wrong = mockWeight(stat({ correct: 0, wrong: 1 }), NOW);
    const right = mockWeight(stat({ correct: 1, wrong: 0 }), NOW);
    expect(wrong).toBeGreaterThan(right);
  });

  it("halves the weight when seen recently", () => {
    const recent = mockWeight(stat({ correct: 1, lastSeen: NOW - 1000 }), NOW);
    const old = mockWeight(stat({ correct: 1, lastSeen: OLD }), NOW);
    expect(recent).toBeCloseTo(old / 2);
  });
});

describe("drillWeight", () => {
  it("treats mixed as a uniform draw", () => {
    expect(drillWeight(undefined, NOW, "mixed")).toBe(1);
    expect(drillWeight(stat({ correct: 9, wrong: 1 }), NOW, "mixed")).toBe(1);
  });

  it("strongly prefers unseen questions in unseen mode", () => {
    const unseen = drillWeight(undefined, NOW, "unseen");
    const seen = drillWeight(stat({ attempts: 3 }), NOW, "unseen");
    expect(unseen).toBeGreaterThan(seen * 10);
  });

  it("prefers wrong answers in weak mode", () => {
    const wrong = drillWeight(stat({ correct: 0, wrong: 2 }), NOW, "weak");
    const right = drillWeight(stat({ correct: 2, wrong: 0 }), NOW, "weak");
    expect(wrong).toBeGreaterThan(right);
  });

  it("still gives unseen questions a chance in weak mode", () => {
    expect(drillWeight(undefined, NOW, "weak")).toBeGreaterThan(1);
  });
});
