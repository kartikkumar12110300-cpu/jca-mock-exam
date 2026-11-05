export const SECTIONS = [
  { id: "english", name: "English", short: "English" },
  { id: "aptitude", name: "Aptitude", short: "Aptitude" },
  { id: "gk", name: "GK", short: "GK" },
  { id: "constitution", name: "Constitution", short: "Constitution" },
  { id: "sc-rules-2013", name: "SC Rules 2013", short: "SC Rules 2013" },
  { id: "sci-rules-1961", name: "Rules 1961", short: "Rules 1961" },
  { id: "computer", name: "Computer", short: "Computer" },
] as const;

export type SectionId = (typeof SECTIONS)[number]["id"];

export const SECTION_IDS = SECTIONS.map((section) => section.id);

export function sectionName(id: string): string {
  return SECTIONS.find((section) => section.id === id)?.name ?? id;
}

export function sectionShort(id: string): string {
  return SECTIONS.find((section) => section.id === id)?.short ?? id;
}

export const EXAM_PATTERN = {
  title: "Full mock - 2026 pattern",
  durationSec: 90 * 60,
  passMark: 50,
  targetMark: 78,
  /** Tentative date from the official notification; drives the header countdown. */
  examDate: "2026-11-20",
  marking: {
    correct: 1,
    wrong: -0.25,
    unattempted: 0,
    bonus: 1,
  },
  sections: [
    { id: "english", count: 20 },
    { id: "aptitude", count: 15 },
    { id: "gk", count: 15 },
    { id: "constitution", count: 15 },
    { id: "sc-rules-2013", count: 10 },
    { id: "sci-rules-1961", count: 10 },
    { id: "computer", count: 15 },
  ],
} as const;

export const TOTAL_QUESTIONS = EXAM_PATTERN.sections.reduce(
  (total, section) => total + section.count,
  0,
);

export const DRILL_SECONDS_PER_QUESTION = 90;
export const DRILL_COUNTS = [5, 10, 15, 20, 30] as const;

/** Learn mode: questions per page, per-session cap, and the resume window. */
export const LEARN_PAGE_SIZE = 10;
export const LEARN_MAX_QUESTIONS = 50;
export const LEARN_COUNTS = [10, 20, 30, 40] as const;
export const LEARN_WINDOW_SEC = 30 * 24 * 60 * 60;

/**
 * Fair pass/target marks for a paper that actually sat `present` questions.
 *
 * The full paper is 100 questions with pass 50 / target 78. Drills are shorter,
 * so judging a 10-question drill against 50 marks would always fail. Scale the
 * thresholds in proportion so every verdict stays honest.
 */
export function scaledTargets(present: number): { pass: number; target: number } {
  if (present <= 0) return { pass: 0, target: 0 };
  if (present >= TOTAL_QUESTIONS) {
    return { pass: EXAM_PATTERN.passMark, target: EXAM_PATTERN.targetMark };
  }
  const ratio = present / TOTAL_QUESTIONS;
  return {
    pass: Math.round(EXAM_PATTERN.passMark * ratio),
    target: Math.round(EXAM_PATTERN.targetMark * ratio),
  };
}

export type Verdict = "target" | "pass" | "below";

/** Classifies a net score against the scaled thresholds for that paper size. */
export function verdictFor(net: number, present: number): Verdict {
  const { pass, target } = scaledTargets(present);
  if (net >= target) return "target";
  if (net >= pass) return "pass";
  return "below";
}

export function verdictLabel(verdict: Verdict): string {
  if (verdict === "target") return "At target";
  if (verdict === "pass") return "Above pass";
  return "Below pass";
}
