import { z } from "zod";
import { db } from "./db";
import { answers, attempts, questions, tests } from "./db/schema";

/**
 * Whole-app backup and restore.
 *
 * The app's entire state is one SQLite file, but a JSON export is friendlier to
 * move between machines than a binary DB: it survives schema additions, can be
 * diffed, and is small enough to email. Restore is a full replace by default.
 */

export const BACKUP_FORMAT = "jca-mock-exam-backup";
export const BACKUP_VERSION = 1;

const questionSchema = z.object({
  id: z.string(),
  sectionId: z.string(),
  topic: z.string(),
  difficulty: z.string(),
  stem: z.string(),
  options: z.array(z.string()),
  correctIndex: z.number().nullable(),
  isBonus: z.boolean(),
  keyStatus: z.string(),
  explanation: z.string(),
  sourceRef: z.string().nullable(),
  sourceType: z.string(),
  paperId: z.string().nullable(),
  status: z.string(),
  tags: z.array(z.string()),
  contentHash: z.string(),
  createdAt: z.number(),
});

const testSchema = z.object({
  id: z.string(),
  title: z.string(),
  kind: z.string(),
  pattern: z.any(),
  durationSec: z.number(),
  questionIds: z.array(z.string()),
  isTemplate: z.boolean(),
  createdAt: z.number(),
});

const attemptSchema = z.object({
  id: z.string(),
  testId: z.string(),
  startedAt: z.number(),
  endsAt: z.number(),
  submittedAt: z.number().nullable(),
  status: z.string(),
  score: z.any(),
  createdAt: z.number(),
});

const answerSchema = z.object({
  attemptId: z.string(),
  questionId: z.string(),
  selectedIndex: z.number().nullable(),
  markedForReview: z.boolean(),
  timeSpentMs: z.number(),
  updatedAt: z.number(),
});

export const backupSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.number().int().min(1),
  exportedAt: z.string(),
  counts: z.record(z.string(), z.number()).optional(),
  questions: z.array(questionSchema),
  tests: z.array(testSchema),
  attempts: z.array(attemptSchema),
  answers: z.array(answerSchema),
});

export type Backup = z.infer<typeof backupSchema>;

export function exportBackup(): Backup {
  const q = db.select().from(questions).all();
  const t = db.select().from(tests).all();
  const a = db.select().from(attempts).all();
  const ans = db.select().from(answers).all();

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    counts: {
      questions: q.length,
      tests: t.length,
      attempts: a.length,
      answers: ans.length,
    },
    questions: q.map((row) => ({ ...row, createdAt: row.createdAt.getTime() })),
    tests: t.map((row) => ({ ...row, createdAt: row.createdAt.getTime() })),
    attempts: a.map((row) => ({
      ...row,
      startedAt: row.startedAt.getTime(),
      endsAt: row.endsAt.getTime(),
      submittedAt: row.submittedAt?.getTime() ?? null,
      createdAt: row.createdAt.getTime(),
    })),
    answers: ans.map((row) => ({ ...row, updatedAt: row.updatedAt.getTime() })),
  };
}

export interface RestoreReport {
  mode: "replace" | "merge";
  questions: number;
  tests: number;
  attempts: number;
  answers: number;
  skipped: number;
}

/**
 * Write a validated backup into the database.
 *
 * - `replace` wipes the four tables first, so the result is byte-for-byte the
 *   backup's content.
 * - `merge` keeps existing rows and only inserts ids it has not seen. Answers
 *   whose attempt or question is missing on this machine are skipped rather
 *   than failing the whole restore.
 */
export function restoreBackup(
  backup: Backup,
  options: { mode?: "replace" | "merge" } = {},
): RestoreReport {
  const mode = options.mode ?? "replace";
  const report: RestoreReport = {
    mode,
    questions: 0,
    tests: 0,
    attempts: 0,
    answers: 0,
    skipped: 0,
  };

  db.transaction((tx) => {
    if (mode === "replace") {
      // Children first: foreign keys are ON.
      tx.delete(answers).run();
      tx.delete(attempts).run();
      tx.delete(tests).run();
      tx.delete(questions).run();
    }

    const questionIds = new Set(
      tx.select({ id: questions.id }).from(questions).all().map((r) => r.id),
    );
    const testIds = new Set(tx.select({ id: tests.id }).from(tests).all().map((r) => r.id));
    const attemptIds = new Set(
      tx.select({ id: attempts.id }).from(attempts).all().map((r) => r.id),
    );

    for (const row of backup.questions) {
      if (questionIds.has(row.id)) {
        report.skipped += 1;
        continue;
      }
      tx.insert(questions)
        .values({
          ...row,
          difficulty: row.difficulty as "easy" | "medium" | "hard",
          keyStatus: row.keyStatus as "official" | "unofficial" | "disputed",
          sourceType: row.sourceType as "pyq" | "ai" | "manual",
          status: row.status as "draft" | "in_review" | "published" | "retired",
          createdAt: new Date(row.createdAt),
        })
        .run();
      questionIds.add(row.id);
      report.questions += 1;
    }

    for (const row of backup.tests) {
      if (testIds.has(row.id)) {
        report.skipped += 1;
        continue;
      }
      tx.insert(tests)
        .values({
          ...row,
          kind: row.kind as "full" | "sectional" | "custom" | "drill",
          createdAt: new Date(row.createdAt),
        })
        .run();
      testIds.add(row.id);
      report.tests += 1;
    }

    for (const row of backup.attempts) {
      if (attemptIds.has(row.id)) {
        report.skipped += 1;
        continue;
      }
      // A paper whose test is missing here cannot be replayed; skip it.
      if (!testIds.has(row.testId)) {
        report.skipped += 1;
        continue;
      }
      tx.insert(attempts)
        .values({
          ...row,
          status: row.status as "in_progress" | "submitted" | "expired" | "abandoned",
          startedAt: new Date(row.startedAt),
          endsAt: new Date(row.endsAt),
          submittedAt: row.submittedAt === null ? null : new Date(row.submittedAt),
          createdAt: new Date(row.createdAt),
        })
        .run();
      attemptIds.add(row.id);
      report.attempts += 1;
    }

    for (const row of backup.answers) {
      // Only restore answers whose attempt and question both exist.
      if (!attemptIds.has(row.attemptId) || !questionIds.has(row.questionId)) {
        report.skipped += 1;
        continue;
      }
      const inserted = tx
        .insert(answers)
        .values({ ...row, updatedAt: new Date(row.updatedAt) })
        .onConflictDoNothing()
        .run();
      if (inserted.changes > 0) report.answers += 1;
      else report.skipped += 1;
    }
  });

  return report;
}
