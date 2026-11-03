import { desc, eq, notInArray } from "drizzle-orm";
import { db } from "./db";
import { answers, attempts, questions, tests, type Score, type Test } from "./db/schema";
import { getSection } from "./pattern";

/**
 * Read-only aggregates over submitted attempts. Used by the dashboard,
 * the mistake notebook and the drill builder.
 *
 * Everything here is derived on demand from the SQLite file — no counters to
 * keep in sync, which matters because attempts can be submitted at any time
 * (including by the auto-submit path).
 */

export interface AttemptSummary {
  id: string;
  title: string;
  kind: string;
  status: string;
  startedAt: number;
  submittedAt: number | null;
  net: number;
  total: number;
  correct: number;
  wrong: number;
  skipped: number;
  bonus: number;
  accuracy: number;
}

function toSummary(row: {
  id: string;
  title: string;
  kind: string;
  status: string;
  startedAt: Date;
  submittedAt: Date | null;
  score: Score | null;
  total: number;
}): AttemptSummary {
  const score = row.score;
  return {
    id: row.id,
    title: row.title,
    kind: row.kind,
    status: row.status,
    startedAt: row.startedAt.getTime(),
    submittedAt: row.submittedAt?.getTime() ?? null,
    net: score?.net ?? 0,
    total: row.total,
    correct: score?.correct ?? 0,
    wrong: score?.wrong ?? 0,
    skipped: score?.skipped ?? 0,
    bonus: score?.bonus ?? 0,
    accuracy: score?.accuracy ?? 0,
  };
}

export interface ListAttemptsOptions {
  /**
   * Hide whole kinds. The dashboard excludes `learn` so untimed practice
   * sessions do not distort mock scores and the trend strip.
   */
  excludeKinds?: Array<Test["kind"]>;
}

/** Newest first. `limit` keeps the dashboard query cheap. */
export function listAttempts(
  limit = 25,
  options: ListAttemptsOptions = {},
): AttemptSummary[] {
  const rows = db
    .select({
      id: attempts.id,
      title: tests.title,
      kind: tests.kind,
      status: attempts.status,
      startedAt: attempts.startedAt,
      submittedAt: attempts.submittedAt,
      score: attempts.score,
      total: tests.questionIds,
    })
    .from(attempts)
    .innerJoin(tests, eq(tests.id, attempts.testId))
    .where(
      options.excludeKinds?.length
        ? notInArray(tests.kind, options.excludeKinds)
        : undefined,
    )
    .orderBy(desc(attempts.startedAt))
    .limit(limit)
    .all();

  return rows.map((r) =>
    toSummary({ ...r, total: Array.isArray(r.total) ? r.total.length : 0 }),
  );
}

export function getAttemptSummary(id: string): AttemptSummary | null {
  const row = db
    .select({
      id: attempts.id,
      title: tests.title,
      kind: tests.kind,
      status: attempts.status,
      startedAt: attempts.startedAt,
      submittedAt: attempts.submittedAt,
      score: attempts.score,
      total: tests.questionIds,
    })
    .from(attempts)
    .innerJoin(tests, eq(tests.id, attempts.testId))
    .where(eq(attempts.id, id))
    .get();

  if (!row) return null;
  return toSummary({ ...row, total: Array.isArray(row.total) ? row.total.length : 0 });
}

export interface SectionMastery {
  sectionId: string;
  short: string;
  /** Questions seen across all submitted attempts. */
  seen: number;
  correct: number;
  wrong: number;
  skipped: number;
  accuracy: number;
  /** Average net marks contributed per attempt that included the section. */
  avgNet: number;
  attempts: number;
}

/**
 * Accuracy per section across every submitted attempt.
 * Bonus questions are ignored (they are free marks, not knowledge).
 *
 * Reads the stored `score.perSection` snapshot, so legacy papers keep their own
 * section breakdown even if the 2026 pattern later changes.
 */
export function sectionMastery(): SectionMastery[] {
  const rows = db
    .select({ score: attempts.score })
    .from(attempts)
    .where(eq(attempts.status, "submitted"))
    .all();

  const buckets = new Map<
    string,
    {
      seen: number;
      correct: number;
      wrong: number;
      skipped: number;
      net: number;
      attempts: Set<number>;
    }
  >();

  rows.forEach((row, attemptIndex) => {
    for (const section of row.score?.perSection ?? []) {
      const bucket =
        buckets.get(section.sectionId) ??
        { seen: 0, correct: 0, wrong: 0, skipped: 0, net: 0, attempts: new Set<number>() };

      bucket.seen += section.total - section.bonus;
      bucket.correct += section.correct;
      bucket.wrong += section.wrong;
      bucket.skipped += section.skipped;
      bucket.net += section.net - section.bonus;
      bucket.attempts.add(attemptIndex);

      buckets.set(section.sectionId, bucket);
    }
  });

  return [...buckets.entries()]
    .map(([sectionId, b]) => ({
      sectionId,
      short: getSection(sectionId)?.short ?? sectionId,
      seen: b.seen,
      correct: b.correct,
      wrong: b.wrong,
      skipped: b.skipped,
      accuracy: b.correct + b.wrong === 0 ? 0 : b.correct / (b.correct + b.wrong),
      avgNet: b.attempts.size === 0 ? 0 : b.net / b.attempts.size,
      attempts: b.attempts.size,
    }))
    .sort((a, b) => {
      const aAttempted = a.correct + a.wrong > 0 ? 0 : 1;
      const bAttempted = b.correct + b.wrong > 0 ? 0 : 1;
      if (aAttempted !== bAttempted) return aAttempted - bAttempted;
      return a.accuracy - b.accuracy;
    });
}

export interface QuestionStat {
  questionId: string;
  sectionId: string;
  attempts: number;
  correct: number;
  wrong: number;
  skipped: number;
  lastSeen: number;
}

/** Per-question history, used to prioritise drills and build the notebook. */
export function questionStats(): Map<string, QuestionStat> {
  const rows = db
    .select({
      questionId: answers.questionId,
      sectionId: questions.sectionId,
      selectedIndex: answers.selectedIndex,
      correctIndex: questions.correctIndex,
      isBonus: questions.isBonus,
      updatedAt: answers.updatedAt,
    })
    .from(answers)
    .innerJoin(attempts, eq(attempts.id, answers.attemptId))
    .innerJoin(questions, eq(questions.id, answers.questionId))
    .where(eq(attempts.status, "submitted"))
    .all();

  const stats = new Map<string, QuestionStat>();

  for (const row of rows) {
    if (row.isBonus) continue;
    const stat =
      stats.get(row.questionId) ??
      {
        questionId: row.questionId,
        sectionId: row.sectionId,
        attempts: 0,
        correct: 0,
        wrong: 0,
        skipped: 0,
        lastSeen: 0,
      };

    stat.attempts += 1;
    if (row.selectedIndex === null) stat.skipped += 1;
    else if (row.correctIndex !== null && row.selectedIndex === row.correctIndex) stat.correct += 1;
    else stat.wrong += 1;

    stat.lastSeen = Math.max(stat.lastSeen, row.updatedAt.getTime());
    stats.set(row.questionId, stat);
  }

  return stats;
}
