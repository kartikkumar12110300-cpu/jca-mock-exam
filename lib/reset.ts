import { eq, inArray, sql } from "drizzle-orm";
import { db, dbReady } from "./db";
import { answers, attempts, tests } from "./db/schema";

/**
 * Destructive maintenance helpers.
 *
 * Clearing practice history is deliberately separate from the question bank:
 * test attempts pollute the dashboard trend and section mastery, and a candidate
 * who has been trying the app out wants a clean slate without re-importing the
 * bank. It is always scoped to one user.
 */

export interface ClearReport {
  attempts: number;
  papers: number;
  answers: number;
}

/**
 * Delete one user's attempts, papers and saved answers. Questions are untouched,
 * so the bank and its provenance survive. Children first because foreign keys
 * are ON.
 */
export async function clearAttempts(userId: string): Promise<ClearReport> {
  await dbReady;

  const rows = await db
    .select({ id: attempts.id, testId: attempts.testId })
    .from(attempts)
    .where(eq(attempts.userId, userId))
    .all();

  const attemptIds = rows.map((row) => row.id);
  const testIds = [...new Set(rows.map((row) => row.testId))];

  const answerCount = attemptIds.length
    ? Number(
        (
          await db
            .select({ n: sql<number>`count(*)` })
            .from(answers)
            .where(inArray(answers.attemptId, attemptIds))
            .get()
        )?.n ?? 0,
      )
    : 0;

  const report: ClearReport = {
    attempts: attemptIds.length,
    papers: testIds.length,
    answers: answerCount,
  };

  await db.transaction(async (tx) => {
    if (attemptIds.length > 0) {
      await tx.delete(answers).where(inArray(answers.attemptId, attemptIds)).run();
    }
    await tx.delete(attempts).where(eq(attempts.userId, userId)).run();

    for (const testId of testIds) {
      const remaining = await tx
        .select({ n: sql<number>`count(*)` })
        .from(attempts)
        .where(eq(attempts.testId, testId))
        .get();
      if (Number(remaining?.n ?? 0) === 0) {
        await tx.delete(tests).where(eq(tests.id, testId)).run();
      }
    }
  });

  return report;
}

/** Whether this user has any practice history worth clearing. */
export async function hasPracticeHistory(userId: string): Promise<boolean> {
  await dbReady;
  const row = await db
    .select({ n: sql<number>`count(*)` })
    .from(attempts)
    .where(eq(attempts.userId, userId))
    .get();
  return Number(row?.n ?? 0) > 0;
}
