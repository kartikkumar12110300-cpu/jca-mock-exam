/**
 * Types shared between the server pages and the client runner.
 * Deliberately contains no answer keys or explanations.
 */

export interface RunnerQuestion {
  id: string;
  sectionId: string;
  stem: string;
  options: string[];
  isBonus: boolean;
}

export interface RunnerSection {
  id: string;
  name: string;
  short: string;
  count: number;
  /** Index range within the flat question list. */
  start: number;
  end: number;
}

export interface RunnerPayload {
  attemptId: string;
  endsAt: number;
  serverNow: number;
  durationSec: number;
  marking: { correct: number; wrong: number; unattempted: number; bonus: number };
  sections: RunnerSection[];
  questions: RunnerQuestion[];
  saved: Record<string, { selectedIndex: number | null; markedForReview: boolean }>;
}
