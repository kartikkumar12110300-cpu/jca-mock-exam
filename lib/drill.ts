import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "./db";
import { answers, attempts, questions, tests, type Question } from "./db/schema";
import { EXAM_PATTERN, getSection, patternSnapshot, SECTIONS } from "./pattern";
import { shuffle, weightedSample } from "./pick";
import { drillWeight, type DrillMode } from "./selection";
import { questionStats } from "./stats";

/**
 * Drill builder and mistake notebook.
 *
 * A drill is just a `tests` row with kind = "drill", so the existing runner,
 * autosave and scoring work unchanged.
 */

export type { DrillMode };

export interface DrillOptions {
  sectionId?: string;
  count?: number;
  mode?: DrillMode;
  /** Injectable RNG so the selection can be tested deterministically. */
  random?: () => number;
}

export const DRILL_SECONDS_PER_QUESTION = 90;

export function createDrill(options: DrillOptions = {}): string {
  const count = Math.max(1, Math.min(40, options.count ?? 10));
  const mode = options.mode ?? "weak";
  const sectionId = options.sectionId;
  const random = options.random ?? Math.random;

  const pool = db
    .select()
    .from(questions)
    .where(
      sectionId
        ? and(eq(questions.status, "published"), eq(questions.sectionId, sectionId))
        : eq(questions.status, "published"),
    )
    .all();

  if (pool.length === 0) {
    throw new Error("No published questions match this drill.");
  }

  // Weighted sample without replacement, then shuffle so two drills over the
  // same pool never serve the same questions in the same order.
  const stats = questionStats();
  const nowMs = Date.now();
  const picked = weightedSample(
    pool,
    count,
    (q) => drillWeight(stats.get(q.id), nowMs, mode),
    random,
  );

  // Keep paper order so a drill reads like a real section; shuffle inside each
  // section so the order still varies between drills.
  const sectionOrder = new Map(SECTIONS.map((s, i) => [s.id, i]));
  const ordered = shuffle(picked, random).sort((a, b) => {
    const sa = sectionOrder.get(a.sectionId as (typeof SECTIONS)[number]["id"]) ?? 99;
    const sb = sectionOrder.get(b.sectionId as (typeof SECTIONS)[number]["id"]) ?? 99;
    return sa - sb;
  });

  const questionIds = ordered.map((q) => q.id);
  const durationSec = questionIds.length * DRILL_SECONDS_PER_QUESTION;

  const usedSections = [...new Set(ordered.map((q) => q.sectionId))];
  const label = sectionId
    ? `${getSection(sectionId)?.short ?? sectionId} drill`
    : mode === "weak"
      ? "Weak-area drill"
      : mode === "unseen"
        ? "Unseen-questions drill"
        : "Mixed drill";

  const snapshot = patternSnapshot();
  const pattern = {
    ...snapshot,
    label,
    totalQuestions: questionIds.length,
    durationSec,
    sections: snapshot.sections.filter((s) => usedSections.includes(s.id)),
  };

  const testId = crypto.randomUUID();
  const now = new Date();

  db.insert(tests)
    .values({
      id: testId,
      title: label,
      kind: "drill",
      pattern,
      durationSec,
      questionIds,
      isTemplate: false,
    })
    .run();

  const attemptId = crypto.randomUUID();

  db.insert(attempts)
    .values({
      id: attemptId,
      testId,
      startedAt: now,
      endsAt: new Date(now.getTime() + durationSec * 1000),
      status: "in_progress",
    })
    .run();

  return attemptId;
}

export interface MistakeRow {
  questionId: string;
  sectionId: string;
  sectionShort: string;
  stem: string;
  options: string[];
  correctIndex: number | null;
  chosenIndex: number | null;
  explanation: string;
  sourceRef: string | null;
  wrongCount: number;
  lastWrongAt: number;
  attemptId: string;
}

/**
 * Every question answered wrong at least once, with the most recent wrong
 * attempt so "review" can jump straight to it. Newest mistakes first.
 */
export function getMistakes(sectionId?: string): MistakeRow[] {
  const rows = db
    .select({
      questionId: answers.questionId,
      sectionId: questions.sectionId,
      stem: questions.stem,
      options: questions.options,
      correctIndex: questions.correctIndex,
      explanation: questions.explanation,
      sourceRef: questions.sourceRef,
      selectedIndex: answers.selectedIndex,
      updatedAt: answers.updatedAt,
      attemptId: answers.attemptId,
      submittedAt: attempts.submittedAt,
    })
    .from(answers)
    .innerJoin(attempts, eq(attempts.id, answers.attemptId))
    .innerJoin(questions, eq(questions.id, answers.questionId))
    .where(and(eq(attempts.status, "submitted"), eq(questions.isBonus, false)))
    .all();

  const byQuestion = new Map<string, MistakeRow>();

  for (const row of rows) {
    if (row.selectedIndex === null) continue;
    if (row.correctIndex !== null && row.selectedIndex === row.correctIndex) continue;
    if (sectionId && row.sectionId !== sectionId) continue;

    const existing = byQuestion.get(row.questionId);
    const at = (row.submittedAt ?? row.updatedAt).getTime();

    if (!existing) {
      byQuestion.set(row.questionId, {
        questionId: row.questionId,
        sectionId: row.sectionId,
        sectionShort: getSection(row.sectionId)?.short ?? row.sectionId,
        stem: row.stem,
        options: row.options,
        correctIndex: row.correctIndex,
        chosenIndex: row.selectedIndex,
        explanation: row.explanation,
        sourceRef: row.sourceRef,
        wrongCount: 1,
        lastWrongAt: at,
        attemptId: row.attemptId,
      });
    } else {
      existing.wrongCount += 1;
      if (at > existing.lastWrongAt) {
        existing.lastWrongAt = at;
        existing.chosenIndex = row.selectedIndex;
        existing.attemptId = row.attemptId;
      }
    }
  }

  return [...byQuestion.values()].sort((a, b) => b.lastWrongAt - a.lastWrongAt);
}

export interface BankRow {
  id: string;
  sectionId: string;
  sectionShort: string;
  topic: string;
  difficulty: string;
  stem: string;
  isBonus: boolean;
  keyStatus: string;
  sourceType: string;
  sourceRef: string | null;
  status: string;
  seen: number;
  correct: number;
  wrong: number;
}

export function listBank(sectionId?: string): BankRow[] {
  const rows = db
    .select()
    .from(questions)
    .where(sectionId ? eq(questions.sectionId, sectionId) : undefined)
    .orderBy(asc(questions.sectionId), asc(questions.createdAt))
    .all();

  const stats = questionStats();

  return rows.map((q) => {
    const stat = stats.get(q.id);
    return {
      id: q.id,
      sectionId: q.sectionId,
      sectionShort: getSection(q.sectionId)?.short ?? q.sectionId,
      topic: q.topic,
      difficulty: q.difficulty,
      stem: q.stem,
      isBonus: q.isBonus,
      keyStatus: q.keyStatus,
      sourceType: q.sourceType,
      sourceRef: q.sourceRef,
      status: q.status,
      seen: stat?.attempts ?? 0,
      correct: stat?.correct ?? 0,
      wrong: stat?.wrong ?? 0,
    };
  });
}

export function bankCounts(): Map<string, number> {
  const rows = db
    .select({ sectionId: questions.sectionId, n: sql<number>`count(*)` })
    .from(questions)
    .where(eq(questions.status, "published"))
    .groupBy(questions.sectionId)
    .all();
  return new Map(rows.map((r) => [r.sectionId, r.n]));
}

/** Sections that actually have questions, for the drill picker. */
export function availableSections(): Array<{ id: string; short: string; count: number }> {
  const counts = bankCounts();
  return EXAM_PATTERN.sections
    .map((s) => ({ id: s.id, short: s.short, count: counts.get(s.id) ?? 0 }))
    .filter((s) => s.count > 0);
}

/** Question ids in a test, used by the result page's "drill these" link. */
export function testQuestionIds(testId: string): string[] {
  const test = db.select({ ids: tests.questionIds }).from(tests).where(eq(tests.id, testId)).get();
  return test?.ids ?? [];
}

/** Unused helper kept for the import pipeline: fetch by id in order. */
export function questionsByIds(ids: string[]): Question[] {
  if (ids.length === 0) return [];
  const rows = db.select().from(questions).where(inArray(questions.id, ids)).all();
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids.map((id) => byId.get(id)).filter((q): q is Question => Boolean(q));
}
