import { z } from "zod";
import { db, dbReady } from "./db";
import { answers, attempts, questions, tests, users } from "./db/schema";

/**
 * Whole-app backup and restore (admin only).
 *
 * The app's entire state is one database, but a JSON export is friendlier to
 * move between machines than a binary file: it survives schema additions, can be
 * diffed, and is small enough to email. Restore is a full replace by default.
 *
 * Accounts are included but sessions are not, so restoring a backup never
 * restores somebody's live cookie. Existing accounts are never deleted by a
 * restore — that would lock the current admin out.
 */

export const BACKUP_FORMAT = "jca-mock-exam-backup";
export const BACKUP_VERSION = 2;

const userSchema = z.object({
  id: z.string(),
  username: z.string(),
  displayName: z.string().default(""),
  passwordHash: z.string(),
  role: z.enum(["user", "admin"]),
  isActive: z.boolean(),
  createdAt: z.number(),
});

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
  /** Absent in v1 backups, which predate accounts. */
  userId: z.string().optional(),
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
  users: z.array(userSchema).optional(),
  questions: z.array(questionSchema),
  tests: z.array(testSchema),
  attempts: z.array(attemptSchema),
  answers: z.array(answerSchema),
});

export type Backup = z.infer<typeof backupSchema>;

export async function exportBackup(): Promise<Backup> {
  await dbReady;

  const u = await db.select().from(users).all();
  const q = await db.select().from(questions).all();
  const t = await db.select().from(tests).all();
  const a = await db.select().from(attempts).all();
  const ans = await db.select().from(answers).all();

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    counts: {
      users: u.length,
      questions: q.length,
      tests: t.length,
      attempts: a.length,
      answers: ans.length,
    },
    users: u.map((row) => ({ ...row, createdAt: row.createdAt.getTime() })),
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
  users: number;
  questions: number;
  tests: number;
  attempts: number;
  answers: number;
  skipped: number;
}

export interface RestoreOptions {
  mode?: "replace" | "merge";
  /** Owner for v1 attempts that predate accounts. Usually the current admin. */
  fallbackUserId?: string;
}

/**
 * Write a validated backup into the database.
 *
 * - `replace` wipes questions, papers, attempts and answers first. Accounts are
 *   kept and only missing ones are added.
 * - `merge` keeps existing rows and only inserts ids it has not seen. Answers
 *   whose attempt or question is missing on this machine are skipped rather
 *   than failing the whole restore.
 */
export async function restoreBackup(
  backup: Backup,
  options: RestoreOptions = {},
): Promise<RestoreReport> {
  await dbReady;

  const mode = options.mode ?? "replace";
  const report: RestoreReport = {
    mode,
    users: 0,
    questions: 0,
    tests: 0,
    attempts: 0,
    answers: 0,
    skipped: 0,
  };

  await db.transaction(async (tx) => {
    if (mode === "replace") {
      // Children first: foreign keys are ON. Users and sessions are preserved.
      await tx.delete(answers).run();
      await tx.delete(attempts).run();
      await tx.delete(tests).run();
      await tx.delete(questions).run();
    }

    const userIds = new Set(
      (await tx.select({ id: users.id }).from(users).all()).map((r) => r.id),
    );
    const usernames = new Set(
      (await tx.select({ username: users.username }).from(users).all()).map((r) => r.username),
    );
    const questionIds = new Set(
      (await tx.select({ id: questions.id }).from(questions).all()).map((r) => r.id),
    );
    const testIds = new Set((await tx.select({ id: tests.id }).from(tests).all()).map((r) => r.id));
    const attemptIds = new Set(
      (await tx.select({ id: attempts.id }).from(attempts).all()).map((r) => r.id),
    );

    for (const row of backup.users ?? []) {
      if (userIds.has(row.id) || usernames.has(row.username)) {
        report.skipped += 1;
        continue;
      }
      await tx
        .insert(users)
        .values({
          ...row,
          createdAt: new Date(row.createdAt),
        })
        .run();
      userIds.add(row.id);
      usernames.add(row.username);
      report.users += 1;
    }

    for (const row of backup.questions) {
      if (questionIds.has(row.id)) {
        report.skipped += 1;
        continue;
      }
      await tx
        .insert(questions)
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
      await tx
        .insert(tests)
        .values({
          ...row,
          kind: row.kind as "full" | "sectional" | "custom" | "drill" | "learn",
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
      const owner = row.userId ?? options.fallbackUserId;
      if (!owner || !userIds.has(owner)) {
        report.skipped += 1;
        continue;
      }
      await tx
        .insert(attempts)
        .values({
          ...row,
          userId: owner,
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
      const inserted = await tx
        .insert(answers)
        .values({ ...row, updatedAt: new Date(row.updatedAt) })
        .onConflictDoNothing()
        .run();
      if (inserted.rowsAffected > 0) report.answers += 1;
      else report.skipped += 1;
    }
  });

  return report;
}
