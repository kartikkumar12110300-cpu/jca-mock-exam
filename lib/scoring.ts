import type { Score, SectionScore } from "./db/schema";

/**
 * Pure scoring engine. The server calls this on submit; the client never
 * computes or submits a score.
 *
 * Rules (2026 paper):
 *   correct   +1
 *   wrong     -0.25
 *   skipped    0
 *   bonus     +1 regardless of what was selected (2025 revised key precedent)
 *
 * Bonus questions are excluded from correct/wrong/skipped/attempted so they
 * cannot inflate accuracy. They are reported separately.
 */

export interface ScorableQuestion {
  id: string;
  sectionId: string;
  correctIndex: number | null;
  isBonus: boolean;
}

export interface ScorableAnswer {
  questionId: string;
  selectedIndex: number | null;
}

export interface MarkingScheme {
  correct: number;
  wrong: number;
  unattempted: number;
  bonus: number;
}

export const DEFAULT_MARKING: MarkingScheme = {
  correct: 1,
  wrong: -0.25,
  unattempted: 0,
  bonus: 1,
};

export function scoreAttempt(
  questions: ScorableQuestion[],
  answers: ScorableAnswer[],
  marking: MarkingScheme = DEFAULT_MARKING,
): Score {
  const selected = new Map(answers.map((a) => [a.questionId, a.selectedIndex]));
  const sections = new Map<string, SectionScore>();

  let correct = 0;
  let wrong = 0;
  let skipped = 0;
  let bonus = 0;
  let net = 0;

  for (const q of questions) {
    const bucket =
      sections.get(q.sectionId) ??
      ({
        sectionId: q.sectionId,
        total: 0,
        attempted: 0,
        correct: 0,
        wrong: 0,
        skipped: 0,
        bonus: 0,
        net: 0,
      } satisfies SectionScore);

    bucket.total += 1;

    if (q.isBonus) {
      bonus += 1;
      bucket.bonus += 1;
      bucket.net += marking.bonus;
      net += marking.bonus;
      sections.set(q.sectionId, bucket);
      continue;
    }

    const choice = selected.get(q.id) ?? null;

    if (choice === null || choice === undefined) {
      skipped += 1;
      bucket.skipped += 1;
      bucket.net += marking.unattempted;
      net += marking.unattempted;
    } else if (q.correctIndex !== null && choice === q.correctIndex) {
      correct += 1;
      bucket.correct += 1;
      bucket.attempted += 1;
      bucket.net += marking.correct;
      net += marking.correct;
    } else {
      wrong += 1;
      bucket.wrong += 1;
      bucket.attempted += 1;
      bucket.net += marking.wrong;
      net += marking.wrong;
    }

    sections.set(q.sectionId, bucket);
  }

  const attempted = correct + wrong;

  return {
    correct,
    wrong,
    skipped,
    bonus,
    attempted,
    raw: correct,
    net,
    accuracy: attempted === 0 ? 0 : correct / attempted,
    perSection: [...sections.values()],
  };
}

/** Net marks a section needs to hit the study plan's target for it. */
export function sectionVerdict(section: SectionScore, target: number): "above" | "on" | "below" {
  if (section.correct >= target) return "above";
  if (section.correct === target - 1) return "on";
  return "below";
}
