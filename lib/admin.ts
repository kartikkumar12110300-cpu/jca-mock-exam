import { desc, eq } from "drizzle-orm";
import { db, dbReady } from "./db";
import { attempts, tests, users, type Score } from "./db/schema";
import { getSection } from "./pattern";
import { getMistakes } from "./drill";
import { listAttempts, sectionMastery, type AttemptSummary, type SectionMastery } from "./stats";

/**
 * Read-only reports for the admin dashboard. Nothing in this module writes to
 * the database, and no admin report is reachable without `requireAdmin()`.
 *
 * Aggregation happens in memory over a handful of rows (five candidates), which
 * keeps the queries simple and avoids storing counters that can drift.
 */

export interface AdminUserSummary {
  id: string;
  username: string;
  displayName: string;
  role: "user" | "admin";
  isActive: boolean;
  createdAt: number;
  attempts: number;
  scored: number;
  inProgress: number;
  bestNet: number | null;
  averageNet: number | null;
  latestNet: number | null;
  latestAt: number | null;
  accuracy: number;
  weakestSection: string | null;
  lastActive: number | null;
}

export interface AdminOverview {
  users: AdminUserSummary[];
  totals: {
    users: number;
    candidates: number;
    scoredAttempts: number;
    inProgress: number;
    activeLast7Days: number;
  };
}

interface AttemptRow {
  userId: string;
  status: string;
  score: Score | null;
  startedAt: Date;
  submittedAt: Date | null;
}

function scored(row: AttemptRow): boolean {
  return row.score !== null;
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function weakestSection(scores: Score[]): string | null {
  const buckets = new Map<string, { correct: number; wrong: number }>();

  for (const score of scores) {
    for (const section of score.perSection ?? []) {
      const bucket = buckets.get(section.sectionId) ?? { correct: 0, wrong: 0 };
      bucket.correct += section.correct;
      bucket.wrong += section.wrong;
      buckets.set(section.sectionId, bucket);
    }
  }

  const ranked = [...buckets.entries()]
    .filter(([, b]) => b.correct + b.wrong > 0)
    .map(([sectionId, b]) => ({
      sectionId,
      accuracy: b.correct / (b.correct + b.wrong),
    }))
    .sort((a, b) => a.accuracy - b.accuracy);

  const worst = ranked[0];
  return worst ? (getSection(worst.sectionId)?.short ?? worst.sectionId) : null;
}

export async function getAdminOverview(): Promise<AdminOverview> {
  await dbReady;

  const [userRows, attemptRows] = await Promise.all([
    db.select().from(users).orderBy(users.username).all(),
    db
      .select({
        userId: attempts.userId,
        status: attempts.status,
        score: attempts.score,
        startedAt: attempts.startedAt,
        submittedAt: attempts.submittedAt,
      })
      .from(attempts)
      .orderBy(desc(attempts.startedAt))
      .all(),
  ]);

  const byUser = new Map<string, AttemptRow[]>();
  for (const row of attemptRows) {
    const list = byUser.get(row.userId) ?? [];
    list.push(row);
    byUser.set(row.userId, list);
  }

  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

  const summaries: AdminUserSummary[] = userRows.map((user) => {
    const rows = byUser.get(user.id) ?? [];
    const withScores = rows.filter((row) => scored(row));
    const nets = withScores.map((row) => row.score!.net);
    const latest = [...withScores].sort(
      (a, b) =>
        (b.submittedAt ?? b.startedAt).getTime() - (a.submittedAt ?? a.startedAt).getTime(),
    )[0];

    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt.getTime(),
      attempts: rows.length,
      scored: withScores.length,
      inProgress: rows.filter((row) => row.status === "in_progress").length,
      bestNet: nets.length ? Math.max(...nets) : null,
      averageNet: mean(nets),
      latestNet: latest?.score?.net ?? null,
      latestAt: latest ? (latest.submittedAt ?? latest.startedAt).getTime() : null,
      accuracy: mean(withScores.map((row) => row.score!.accuracy)) ?? 0,
      weakestSection: weakestSection(withScores.map((row) => row.score!)),
      lastActive: rows.length
        ? Math.max(...rows.map((row) => (row.submittedAt ?? row.startedAt).getTime()))
        : null,
    };
  });

  const activeLast7Days = summaries.filter(
    (summary) => summary.lastActive !== null && summary.lastActive >= sevenDaysAgo,
  ).length;

  return {
    users: summaries,
    totals: {
      users: summaries.length,
      candidates: summaries.filter((summary) => summary.role === "user").length,
      scoredAttempts: summaries.reduce((sum, summary) => sum + summary.scored, 0),
      inProgress: summaries.reduce((sum, summary) => sum + summary.inProgress, 0),
      activeLast7Days,
    },
  };
}

export interface KindBreakdown {
  kind: string;
  attempts: number;
  averageNet: number;
}

export interface AdminUserDetail {
  id: string;
  username: string;
  displayName: string;
  role: "user" | "admin";
  isActive: boolean;
  createdAt: number;
  attemptCount: number;
  scoredCount: number;
  inProgressCount: number;
  bestNet: number | null;
  averageNet: number | null;
  accuracy: number;
  lastActive: number | null;
  attempts: AttemptSummary[];
  mastery: SectionMastery[];
  byKind: KindBreakdown[];
  mistakes: number;
  trend: Array<{ id: string; net: number; total: number; at: number; kind: string }>;
}

export async function getAdminUserDetail(userId: string): Promise<AdminUserDetail | null> {
  await dbReady;

  const user = await db.select().from(users).where(eq(users.id, userId)).get();
  if (!user) return null;

  const [rows, mastery, mistakes] = await Promise.all([
    listAttempts(userId, 500),
    sectionMastery(userId),
    getMistakes(userId),
  ]);

  const withScores = rows.filter(
    (row) => row.status === "submitted" || row.status === "expired",
  );
  const nets = withScores.map((row) => row.net);
  const metrics = await db
    .select({ score: attempts.score })
    .from(attempts)
    .where(eq(attempts.userId, userId))
    .all();

  const accuracies = metrics
    .map((row) => row.score?.accuracy)
    .filter((value): value is number => typeof value === "number");

  const kinds = new Map<string, { attempts: number; net: number }>();
  for (const row of withScores) {
    const bucket = kinds.get(row.kind) ?? { attempts: 0, net: 0 };
    bucket.attempts += 1;
    bucket.net += row.net;
    kinds.set(row.kind, bucket);
  }

  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt.getTime(),
    attemptCount: rows.length,
    scoredCount: withScores.length,
    inProgressCount: rows.filter((row) => row.status === "in_progress").length,
    bestNet: nets.length ? Math.max(...nets) : null,
    averageNet: mean(nets),
    accuracy: mean(accuracies) ?? 0,
    lastActive: rows.length
      ? Math.max(...rows.map((row) => row.submittedAt ?? row.startedAt))
      : null,
    attempts: rows,
    mastery,
    byKind: [...kinds.entries()].map(([kind, bucket]) => ({
      kind,
      attempts: bucket.attempts,
      averageNet: bucket.net / bucket.attempts,
    })),
    mistakes: mistakes.length,
    trend: [...withScores]
      .reverse()
      .slice(-20)
      .map((row) => ({
        id: row.id,
        net: row.net,
        total: row.total,
        at: row.submittedAt ?? row.startedAt,
        kind: row.kind,
      })),
  };
}

/** Shared helper for admin cards: total questions in a paper. */
export async function paperSize(testId: string): Promise<number> {
  await dbReady;
  const row = await db
    .select({ ids: tests.questionIds })
    .from(tests)
    .where(eq(tests.id, testId))
    .get();
  return row?.ids.length ?? 0;
}
