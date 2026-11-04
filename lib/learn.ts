import { and, eq } from "drizzle-orm";
import { getAttemptBundle } from "./attempts";
import { db, dbReady } from "./db";
import { attempts, questions, tests, type Attempt, type Answer, type Question, type Test } from "./db/schema";
import type { Viewer } from "./auth/types";
import { getSection, patternSnapshot, SECTIONS } from "./pattern";
import { shuffle, weightedSample } from "./pick";
import { mockWeight } from "./selection";
import { questionStats } from "./stats";

/**
 * Learn mode.
 *
 * Same tables as a mock (a `tests` row plus an `attempts` row), but:
 *   - no clock — the learner reads the explanation before moving on,
 *   - the client receives the answer key so it can mark each question instantly,
 *   - the session is shown in pages of `LEARN_PAGE_SIZE` questions.
 *
 * Answers are still saved through the normal endpoint, so learn sessions feed
 * per-question stats, section mastery and the mistake notebook.
 */

export const LEARN_PAGE_SIZE = 10;
export const LEARN_MAX_QUESTIONS = 50;

/** A learn session stays open long enough that a learner can leave and resume. */
const LEARN_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export class LearnError extends Error {}

export interface LearnOptions {
  sectionId?: string;
  count?: number;
  /** Injectable RNG so the selection can be tested deterministically. */
  random?: () => number;
}

export interface LearnBundle {
  attempt: Attempt;
  test: Test;
  questions: Question[];
  answers: Answer[];
}

/**
 * Builds a learn session from the bank.
 *
 * Selection follows the full-mock policy — unseen questions first, then ones
 * answered wrong, recently-served deprioritised — so learn mode also rotates
 * through the bank instead of drilling the same first ten rows.
 */
export async function createLearnSession(
  userId: string,
  options: LearnOptions = {},
): Promise<string> {
  await dbReady;

  const count = Math.max(1, Math.min(LEARN_MAX_QUESTIONS, options.count ?? LEARN_PAGE_SIZE));
  const random = options.random ?? Math.random;
  const stats = await questionStats(userId);
  const nowMs = Date.now();

  const pool = await db
    .select({ id: questions.id, sectionId: questions.sectionId })
    .from(questions)
    .where(
      options.sectionId
        ? and(eq(questions.status, "published"), eq(questions.sectionId, options.sectionId))
        : eq(questions.status, "published"),
    )
    .all();

  if (pool.length === 0) {
    throw new LearnError("No published questions match this learn session.");
  }

  const picked = weightedSample(
    pool,
    count,
    (q) => mockWeight(stats.get(q.id), nowMs),
    random,
  );

  // Read like a paper: section order, shuffled inside each section.
  const sectionOrder = new Map(SECTIONS.map((s, i) => [s.id, i]));
  const ordered = shuffle(picked, random).sort((a, b) => {
    const sa = sectionOrder.get(a.sectionId as (typeof SECTIONS)[number]["id"]) ?? 99;
    const sb = sectionOrder.get(b.sectionId as (typeof SECTIONS)[number]["id"]) ?? 99;
    return sa - sb;
  });

  const questionIds = ordered.map((q) => q.id);
  const usedSections = [...new Set(ordered.map((q) => q.sectionId))];
  const section = options.sectionId ? getSection(options.sectionId) : undefined;
  const label = section ? `Learn — ${section.short}` : "Learn — mixed";

  const snapshot = patternSnapshot();
  const pattern = {
    ...snapshot,
    label,
    totalQuestions: questionIds.length,
    durationSec: 0,
    sections: snapshot.sections.filter((s) => usedSections.includes(s.id)),
  };

  const testId = crypto.randomUUID();
  const now = new Date();

  await db
    .insert(tests)
    .values({
      id: testId,
      title: label,
      kind: "learn",
      pattern,
      durationSec: 0,
      questionIds,
      isTemplate: false,
    })
    .run();

  const attemptId = crypto.randomUUID();

  await db
    .insert(attempts)
    .values({
      id: attemptId,
      userId,
      testId,
      startedAt: now,
      endsAt: new Date(now.getTime() + LEARN_WINDOW_MS),
      status: "in_progress",
    })
    .run();

  return attemptId;
}

/** Loads a learn session for its owner, or null if the id is not a learn attempt. */
export async function getLearnBundle(
  attemptId: string,
  viewer: Viewer,
): Promise<LearnBundle | null> {
  const bundle = await getAttemptBundle(attemptId, viewer);
  if (!bundle || bundle.test.kind !== "learn") return null;
  // The instant answer key stays with the owner.
  if (bundle.attempt.userId !== viewer.id) return null;

  return {
    attempt: bundle.attempt,
    test: bundle.test,
    questions: bundle.questions,
    answers: bundle.answers,
  };
}
