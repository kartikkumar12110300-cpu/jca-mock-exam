import { and, eq, inArray } from "drizzle-orm";
import { db, dbReady } from "./db";
import { answers, attempts, questions, tests, type Question } from "./db/schema";
import { canReadUser, type Viewer } from "./auth/types";
import { EXAM_PATTERN, SECTIONS, patternSnapshot } from "./pattern";
import { shuffle, weightedSample } from "./pick";
import { scoreAttempt, type MarkingScheme } from "./scoring";
import { mockWeight } from "./selection";
import { questionStats } from "./stats";

/** Answers arriving after the bell are still accepted briefly, so a slow save isn't lost. */
const GRACE_MS = 15_000;

export class AttemptError extends Error {}

export interface FullMockOptions {
  /** Injectable RNG so the composition can be tested deterministically. */
  random?: () => number;
}

/**
 * Builds a 2026-pattern full mock from whatever is published in the bank.
 *
 * Each section draws a fresh weighted sample, so a 100-question paper out of a
 * much larger bank changes every attempt instead of always serving the oldest
 * rows. Sections are filled in paper order; if a section has fewer questions
 * than the paper asks for, the test simply has fewer — never duplicate a question.
 */
export async function createFullMock(
  userId: string,
  options: FullMockOptions = {},
): Promise<string> {
  await dbReady;

  const random = options.random ?? Math.random;
  const stats = await questionStats(userId);
  const nowMs = Date.now();
  const questionIds: string[] = [];

  for (const section of SECTIONS) {
    const pool = await db
      .select({ id: questions.id })
      .from(questions)
      .where(and(eq(questions.status, "published"), eq(questions.sectionId, section.id)))
      .all();

    const picked = weightedSample(
      pool,
      section.count,
      (q) => mockWeight(stats.get(q.id), nowMs),
      random,
    );

    // Shuffle within the section so question order also varies between papers.
    questionIds.push(...shuffle(picked, random).map((q) => q.id));
  }

  if (questionIds.length === 0) {
    throw new AttemptError("The question bank is empty. Run `npm run db:seed` first.");
  }

  const testId = crypto.randomUUID();
  const now = new Date();

  await db
    .insert(tests)
    .values({
      id: testId,
      title: "Full mock — 2026 pattern",
      kind: "full",
      pattern: patternSnapshot(),
      durationSec: EXAM_PATTERN.durationSec,
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
      endsAt: new Date(now.getTime() + EXAM_PATTERN.durationSec * 1000),
      status: "in_progress",
    })
    .run();

  return attemptId;
}

export interface AttemptBundle {
  attempt: typeof attempts.$inferSelect;
  test: typeof tests.$inferSelect;
  questions: Question[];
  answers: (typeof answers.$inferSelect)[];
}

/**
 * Loads a paper for its owner. Admins may read any submitted attempt for
 * monitoring; they never get write access through this path.
 */
export async function getAttemptBundle(
  attemptId: string,
  viewer: Viewer,
): Promise<AttemptBundle | null> {
  await dbReady;

  const attempt = await db.select().from(attempts).where(eq(attempts.id, attemptId)).get();
  if (!attempt) return null;
  if (!canReadUser(viewer, attempt.userId)) return null;

  const test = await db.select().from(tests).where(eq(tests.id, attempt.testId)).get();
  if (!test) return null;

  const rows = test.questionIds.length
    ? await db.select().from(questions).where(inArray(questions.id, test.questionIds)).all()
    : [];

  const byId = new Map(rows.map((r) => [r.id, r]));
  const ordered = test.questionIds
    .map((id) => byId.get(id))
    .filter((q): q is Question => Boolean(q));

  const saved = await db.select().from(answers).where(eq(answers.attemptId, attemptId)).all();

  return { attempt, test, questions: ordered, answers: saved };
}

export interface AnswerInput {
  questionId: string;
  selectedIndex: number | null;
  markedForReview?: boolean;
  timeSpentMs?: number;
}

export type SaveResult = { ok: true } | { ok: false; reason: "expired" | "submitted" | "missing" };

export async function saveAnswers(
  attemptId: string,
  viewer: Viewer,
  entries: AnswerInput[],
): Promise<SaveResult> {
  await dbReady;

  const attempt = await db.select().from(attempts).where(eq(attempts.id, attemptId)).get();
  if (!attempt) return { ok: false, reason: "missing" };
  // Only the owner may write, even if the caller is an admin.
  if (attempt.userId !== viewer.id) return { ok: false, reason: "missing" };
  if (attempt.status !== "in_progress") return { ok: false, reason: "submitted" };

  const now = Date.now();
  if (now > attempt.endsAt.getTime() + GRACE_MS) {
    await db.update(attempts).set({ status: "expired" }).where(eq(attempts.id, attemptId)).run();
    return { ok: false, reason: "expired" };
  }

  const test = await db.select().from(tests).where(eq(tests.id, attempt.testId)).get();
  const allowed = new Set(test?.questionIds ?? []);

  for (const entry of entries) {
    if (!allowed.has(entry.questionId)) continue;
    if (entry.selectedIndex !== null && (entry.selectedIndex < 0 || entry.selectedIndex > 3)) {
      continue;
    }

    await db
      .insert(answers)
      .values({
        attemptId,
        questionId: entry.questionId,
        selectedIndex: entry.selectedIndex,
        markedForReview: entry.markedForReview ?? false,
        timeSpentMs: Math.max(0, Math.round(entry.timeSpentMs ?? 0)),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [answers.attemptId, answers.questionId],
        set: {
          selectedIndex: entry.selectedIndex,
          markedForReview: entry.markedForReview ?? false,
          timeSpentMs: Math.max(0, Math.round(entry.timeSpentMs ?? 0)),
          updatedAt: new Date(),
        },
      })
      .run();
  }

  return { ok: true };
}

export type SubmitResult =
  | { ok: true; score: NonNullable<typeof attempts.$inferSelect.score> }
  | { ok: false; reason: "missing" };

export async function submitAttempt(attemptId: string, viewer: Viewer) {
  await dbReady;

  const bundle = await getAttemptBundle(attemptId, viewer);
  if (!bundle || bundle.attempt.userId !== viewer.id) {
    return { ok: false as const, reason: "missing" as const };
  }

  // Idempotent: a double click returns the stored score.
  if (bundle.attempt.status === "submitted" && bundle.attempt.score) {
    return { ok: true as const, score: bundle.attempt.score };
  }

  const marking = (bundle.test.pattern.marking ?? EXAM_PATTERN.marking) as MarkingScheme;

  const score = scoreAttempt(
    bundle.questions.map((q) => ({
      id: q.id,
      sectionId: q.sectionId,
      correctIndex: q.correctIndex,
      isBonus: q.isBonus,
    })),
    bundle.answers.map((a) => ({ questionId: a.questionId, selectedIndex: a.selectedIndex })),
    marking,
  );

  const now = Date.now();
  const expired = now > bundle.attempt.endsAt.getTime() + GRACE_MS;

  await db
    .update(attempts)
    .set({
      status: expired ? "expired" : "submitted",
      submittedAt: new Date(),
      score,
    })
    .where(eq(attempts.id, attemptId))
    .run();

  return { ok: true as const, score };
}
