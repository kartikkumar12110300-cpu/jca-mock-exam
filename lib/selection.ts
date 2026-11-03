import type { QuestionStat } from "./stats";

/**
 * Selection weights shared by full mocks and drills.
 *
 * Kept pure (no database access) so the policy can be unit tested with a seeded
 * random source. The actual sampling lives in `lib/pick.ts`.
 */

/** A question never served before is this much likelier than a mastered one. */
export const UNSEEN_WEIGHT = 8;
/** Seen this recently? Halve the weight so the same paper doesn't repeat. */
export const RECENT_MS = 7 * 24 * 60 * 60 * 1000;

function wrongRate(stat: QuestionStat): number {
  const answered = stat.correct + stat.wrong;
  return answered === 0 ? 0.5 : stat.wrong / answered;
}

/**
 * Full-mock weight: rotation *and* reinforcement.
 *
 * Unseen questions are picked first so the whole bank gets used, questions
 * answered wrong come back sooner, and a recently-served question is
 * deprioritised. Randomness is applied on top by the sampler, so two papers
 * over the same pool still differ.
 */
export function mockWeight(stat: QuestionStat | undefined, now: number): number {
  if (!stat || stat.attempts === 0) return UNSEEN_WEIGHT;

  let weight = 1 + wrongRate(stat) * 4;
  if (stat.lastSeen > now - RECENT_MS) weight *= 0.5;

  return weight;
}

export type DrillMode = "weak" | "unseen" | "mixed";

/**
 * Drill weight per mode.
 *
 * - `mixed`  — uniform, a genuine random draw from the whole pool.
 * - `unseen` — heavily prefers questions never attempted, then the least seen.
 * - `weak`   — prefers questions answered wrong, with unseen ones still likely
 *              enough to keep breadth.
 */
export function drillWeight(
  stat: QuestionStat | undefined,
  now: number,
  mode: DrillMode,
): number {
  if (mode === "mixed") return 1;

  const unseen = !stat || stat.attempts === 0;

  if (mode === "unseen") {
    if (unseen) return 12;
    const recency = stat.lastSeen > now - RECENT_MS ? 0.5 : 1;
    return (1 / (1 + stat.attempts)) * recency;
  }

  if (unseen) return 4;

  let weight = 1 + wrongRate(stat) * 6;
  if (stat.lastSeen > now - RECENT_MS) weight *= 0.5;

  return weight;
}
