import { sql } from "drizzle-orm";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import { db } from "./db";
import { answers, attempts, tests } from "./db/schema";

/**
 * Destructive maintenance helpers.
 *
 * Clearing practice history is deliberately separate from the question bank:
 * test attempts pollute the dashboard trend and section mastery, and a candidate
 * who has been trying the app out wants a clean slate without re-importing the
 * bank.
 */

export interface ClearReport {
  attempts: number;
  papers: number;
  answers: number;
}

function countRows(table: SQLiteTable): number {
  const row = db.select({ n: sql<number>`count(*)` }).from(table).get();
  return row?.n ?? 0;
}

/**
 * Delete every attempt, paper and saved answer. Questions are untouched, so the
 * bank and its provenance survive. Children first because foreign keys are ON.
 */
export function clearAttempts(): ClearReport {
  const report: ClearReport = {
    attempts: countRows(attempts),
    papers: countRows(tests),
    answers: countRows(answers),
  };

  db.transaction((tx) => {
    tx.delete(answers).run();
    tx.delete(attempts).run();
    tx.delete(tests).run();
  });

  return report;
}

/** Whether there is any practice history worth clearing. */
export function hasPracticeHistory(): boolean {
  return countRows(attempts) > 0;
}
