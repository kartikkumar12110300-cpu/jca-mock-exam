/**
 * The 2026 SCI Junior Court Assistant objective paper.
 *
 * Source of truth: 00_Official/SCI_JCA_2026_Official_Notification.pdf
 * Cross-checked against 04_Notes/01_Exam_Pattern_2026.md.
 *
 * This file is deliberately the ONLY place exam mechanics are defined.
 * The runner, scoring engine and analytics all read from here.
 */

export type SectionId =
  | "english"
  | "aptitude"
  | "gk"
  | "constitution"
  | "sc-rules-2013"
  | "sci-rules-1961"
  | "computer";

export interface SectionConfig {
  id: SectionId;
  name: string;
  short: string;
  /** Questions asked in the 2026 paper. */
  count: number;
  /** Realistic correct-answer target from the 17-day study plan. */
  target: number;
  /** Shown in the UI to explain what the section covers. */
  blurb: string;
}

export const SECTIONS: SectionConfig[] = [
  {
    id: "english",
    name: "General English (incl. Comprehension)",
    short: "English",
    count: 20,
    target: 14,
    blurb: "Grammar, vocabulary, error spotting, comprehension",
  },
  {
    id: "aptitude",
    name: "General Aptitude",
    short: "Aptitude",
    count: 15,
    target: 11,
    blurb: "Quantitative aptitude, reasoning, series, percentages",
  },
  {
    id: "gk",
    name: "General Knowledge",
    short: "GK",
    count: 15,
    target: 8,
    blurb: "Static GK and current affairs",
  },
  {
    id: "constitution",
    name: "Provisions Relating to Judiciary in the Constitution of India",
    short: "Constitution",
    count: 15,
    target: 10,
    blurb: "Articles 124–147, one-liner recall",
  },
  {
    id: "sc-rules-2013",
    name: "Supreme Court Rules, 2013",
    short: "SC Rules 2013",
    count: 10,
    target: 8,
    blurb: "Orders I–IV, definitions, AoR, vacations",
  },
  {
    id: "sci-rules-1961",
    name: "SCI Officers & Servants (Conditions of Service and Conduct) Rules, 1961",
    short: "Rules 1961",
    count: 10,
    target: 8,
    blurb: "Parts I–V, penalties, discipline, conduct",
  },
  {
    id: "computer",
    name: "Computer Knowledge",
    short: "Computer",
    count: 15,
    target: 12,
    blurb: "Fundamentals, MS Office, internet, shortcuts",
  },
];

export const MARKING = {
  correct: 1,
  wrong: -0.25,
  unattempted: 0,
  /** A bonus question is awarded full marks to every candidate. */
  bonus: 1,
} as const;

export const EXAM_PATTERN = {
  id: "jca-2026",
  label: "SCI JCA 2026 — Objective Test",
  totalQuestions: SECTIONS.reduce((n, s) => n + s.count, 0), // 100
  durationSec: 90 * 60,
  marking: MARKING,
  passMark: 50,
  /** Realistic "comfortably clear" score from the 17-day plan. */
  targetMark: 78,
  /** Tentative, per the official notification. Read from config, never hardcode. */
  examDate: "2026-11-20",
  sections: SECTIONS,
} as const;

export function getSection(id: string): SectionConfig | undefined {
  return SECTIONS.find((s) => s.id === id);
}

/**
 * Fair pass/target marks for a paper that actually sat `present` questions.
 *
 * The full 2026 paper is 100 questions with pass 50 / target 78. When the bank
 * is smaller the runner composes a shorter paper, and judging it against the
 * absolute marks would be misleading (a 29-question paper can never reach 50).
 * Scale the thresholds in proportion so a short mock stays honest and useful.
 */
export function scaledTargets(present: number): { pass: number; target: number } {
  if (present <= 0) return { pass: 0, target: 0 };
  if (present >= EXAM_PATTERN.totalQuestions) {
    return { pass: EXAM_PATTERN.passMark, target: EXAM_PATTERN.targetMark };
  }
  const ratio = present / EXAM_PATTERN.totalQuestions;
  return {
    pass: Math.round(EXAM_PATTERN.passMark * ratio),
    target: Math.round(EXAM_PATTERN.targetMark * ratio),
  };
}

export function sectionLabel(id: string): string {
  return getSection(id)?.short ?? id;
}

/** A snapshot stored on each test/paper so legacy 125-Q papers stay intact. */
export interface PatternSnapshot {
  label: string;
  durationSec: number;
  totalQuestions: number;
  marking: { correct: number; wrong: number; unattempted: number; bonus: number };
  sections: Array<{ id: string; name: string; count: number }>;
}

export function patternSnapshot(): PatternSnapshot {
  return {
    label: EXAM_PATTERN.label,
    durationSec: EXAM_PATTERN.durationSec,
    totalQuestions: EXAM_PATTERN.totalQuestions,
    marking: { ...EXAM_PATTERN.marking },
    sections: SECTIONS.map((s) => ({ id: s.id, name: s.short, count: s.count })),
  };
}
