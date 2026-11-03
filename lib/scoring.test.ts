import { describe, expect, it } from "vitest";
import { scoreAttempt, type ScorableQuestion } from "./scoring";

const q = (id: string, correctIndex: number | null, extra?: Partial<ScorableQuestion>): ScorableQuestion => ({
  id,
  sectionId: "english",
  correctIndex,
  isBonus: false,
  ...extra,
});

describe("scoreAttempt", () => {
  it("scores 1 for correct, -0.25 for wrong, 0 for skipped", () => {
    const questions = [q("a", 0), q("b", 1), q("c", 2), q("d", 3)];
    const score = scoreAttempt(questions, [
      { questionId: "a", selectedIndex: 0 }, // correct
      { questionId: "b", selectedIndex: 0 }, // wrong
      { questionId: "c", selectedIndex: null }, // skipped
      { questionId: "d", selectedIndex: 3 }, // correct
    ]);

    expect(score.correct).toBe(2);
    expect(score.wrong).toBe(1);
    expect(score.skipped).toBe(1);
    expect(score.attempted).toBe(3);
    expect(score.net).toBe(1.75); // 2 - 0.25
    expect(score.accuracy).toBeCloseTo(2 / 3);
  });

  it("treats a missing answer row as skipped", () => {
    const score = scoreAttempt([q("a", 0), q("b", 1)], [{ questionId: "a", selectedIndex: 0 }]);
    expect(score.skipped).toBe(1);
    expect(score.net).toBe(1);
  });

  it("awards full marks for bonus questions even when unattempted", () => {
    const questions = [q("a", 0), q("bonus", null, { isBonus: true })];
    const score = scoreAttempt(questions, [{ questionId: "a", selectedIndex: 1 }]);

    expect(score.bonus).toBe(1);
    expect(score.net).toBe(0.75); // -0.25 + 1
    // bonus must not inflate accuracy
    expect(score.attempted).toBe(1);
    expect(score.correct).toBe(0);
    expect(score.accuracy).toBe(0);
  });

  it("does not penalise a wrong answer on a bonus question", () => {
    const questions = [q("bonus", null, { isBonus: true })];
    const score = scoreAttempt(questions, [{ questionId: "bonus", selectedIndex: 2 }]);
    expect(score.net).toBe(1);
    expect(score.wrong).toBe(0);
  });

  it("breaks the score down per section", () => {
    const questions = [
      q("a", 0, { sectionId: "english" }),
      q("b", 0, { sectionId: "english" }),
      q("c", 0, { sectionId: "computer" }),
    ];
    const score = scoreAttempt(questions, [
      { questionId: "a", selectedIndex: 0 },
      { questionId: "b", selectedIndex: 1 },
      { questionId: "c", selectedIndex: null },
    ]);

    const english = score.perSection.find((s) => s.sectionId === "english")!;
    const computer = score.perSection.find((s) => s.sectionId === "computer")!;

    expect(english).toMatchObject({ total: 2, correct: 1, wrong: 1, skipped: 0, net: 0.75 });
    expect(computer).toMatchObject({ total: 1, correct: 0, wrong: 0, skipped: 1, net: 0 });
  });

  it("keeps net score exact at quarter-point steps", () => {
    const questions = Array.from({ length: 100 }, (_, i) => q(`q${i}`, 0));
    const answers = questions.map((question, i) => ({
      questionId: question.id,
      selectedIndex: i < 70 ? 0 : 1, // 70 right, 30 wrong
    }));
    const score = scoreAttempt(questions, answers);
    expect(score.net).toBe(62.5); // 70 - 7.5
  });

  it("returns zeroed accuracy when nothing was attempted", () => {
    const score = scoreAttempt([q("a", 0)], []);
    expect(score.accuracy).toBe(0);
    expect(score.net).toBe(0);
  });
});
