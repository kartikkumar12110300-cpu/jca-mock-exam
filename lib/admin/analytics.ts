import { answers, attempts, questions, tests, users } from "@/lib/db/collections";
import type { AttemptDoc } from "@/lib/db/types";
import { EXAM_PATTERN, sectionName } from "@/lib/exam/pattern";

interface AttemptAggregate {
  _id: string;
  attempts: number;
  avgPercent: number;
  bestPercent: number;
  avgNet: number;
  bestNet: number;
  lastSubmittedAt: Date | null;
}

export interface UserSummary {
  id: string;
  username: string;
  displayName: string;
  role: "user" | "admin";
  active: boolean;
  createdAt: Date;
  lastLoginAt: Date | null;
  attempts: number;
  avgPercent: number;
  bestPercent: number;
  avgNet: number;
  bestNet: number;
  lastSubmittedAt: Date | null;
}

export async function listUserSummaries(): Promise<UserSummary[]> {
  const [userDocs, aggregates] = await Promise.all([
    (await users()).find({}).sort({ role: 1, username: 1 }).toArray(),
    (await attempts())
      .aggregate<AttemptAggregate>([
        { $match: { status: "submitted" } },
        {
          $group: {
            _id: "$userId",
            attempts: { $sum: 1 },
            avgPercent: { $avg: "$score.percent" },
            bestPercent: { $max: "$score.percent" },
            avgNet: { $avg: "$score.total" },
            bestNet: { $max: "$score.total" },
            lastSubmittedAt: { $max: "$submittedAt" },
          },
        },
      ])
      .toArray(),
  ]);

  const byUser = new Map(aggregates.map((row) => [row._id, row]));

  return userDocs.map((user) => {
    const stats = byUser.get(user._id);
    return {
      id: user._id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      active: user.active,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
      attempts: stats?.attempts ?? 0,
      avgPercent: round(stats?.avgPercent ?? 0),
      bestPercent: round(stats?.bestPercent ?? 0),
      avgNet: round(stats?.avgNet ?? 0),
      bestNet: round(stats?.bestNet ?? 0),
      lastSubmittedAt: stats?.lastSubmittedAt ?? null,
    };
  });
}

export interface SectionAccuracy {
  sectionId: string;
  section: string;
  total: number;
  correct: number;
  wrong: number;
  accuracy: number;
}

export interface RecentAttempt {
  id: string;
  userId: string;
  username: string;
  displayName: string;
  title: string;
  kind: string;
  submittedAt: Date | null;
  score: number;
  percent: number;
}

export interface MissedQuestion {
  questionId: string;
  stem: string;
  section: string;
  wrong: number;
}

export interface AdminOverview {
  users: number;
  activeUsers: number;
  submittedAttempts: number;
  inProgressAttempts: number;
  /** Submitted full mocks only — the papers the pass mark applies to. */
  fullMocks: number;
  averagePercent: number;
  averageNet: number;
  passRate: number;
  sections: SectionAccuracy[];
  recentAttempts: RecentAttempt[];
  mostMissed: MissedQuestion[];
}

export async function getAdminOverview(): Promise<AdminOverview> {
  const [
    userDocs,
    submittedCount,
    inProgressCount,
    scoreStats,
    sectionRows,
    recentDocs,
    missedRows,
  ] = await Promise.all([
    (await users()).find({}).toArray(),
    (await attempts()).countDocuments({ status: "submitted" }),
    (await attempts()).countDocuments({ status: "in_progress" }),
    // Pass mark and average are only meaningful for full mocks. Drills are
    // short, so counting a 10-question drill as "below pass" would be a lie.
    (await attempts())
      .aggregate<{
        avgPercent: number;
        avgNet: number;
        passCount: number;
        fullMocks: number;
      }>([
        { $match: { status: "submitted" } },
        {
          $lookup: {
            from: "tests",
            localField: "testId",
            foreignField: "_id",
            as: "test",
          },
        },
        { $unwind: "$test" },
        { $match: { "test.kind": "full" } },
        {
          $group: {
            _id: null,
            fullMocks: { $sum: 1 },
            avgPercent: { $avg: "$score.percent" },
            avgNet: { $avg: "$score.total" },
            passCount: {
              $sum: {
                $cond: [{ $gte: ["$score.total", EXAM_PATTERN.passMark] }, 1, 0],
              },
            },
          },
        },
      ])
      .toArray(),
    (await attempts())
      .aggregate<{
        _id: string;
        total: number;
        correct: number;
        wrong: number;
      }>([
        { $match: { status: "submitted" } },
        { $unwind: "$score.sections" },
        {
          $group: {
            _id: "$score.sections.sectionId",
            total: { $sum: "$score.sections.total" },
            correct: { $sum: "$score.sections.correct" },
            wrong: { $sum: "$score.sections.wrong" },
          },
        },
      ])
      .toArray(),
    (await attempts())
      .find({ status: "submitted" })
      .sort({ submittedAt: -1 })
      .limit(10)
      .toArray(),
    (await answers())
      .aggregate<{ _id: string; wrong: number }>([
        { $match: { isCorrect: false } },
        { $group: { _id: "$questionId", wrong: { $sum: 1 } } },
        { $sort: { wrong: -1 } },
        { $limit: 5 },
      ])
      .toArray(),
  ]);

  const stats = scoreStats[0];
  const fullMocks = stats?.fullMocks ?? 0;
  const sectionMap = new Map(sectionRows.map((row) => [row._id, row]));

  const sections: SectionAccuracy[] = EXAM_PATTERN.sections.map((section) => {
    const row = sectionMap.get(section.id);
    const total = row?.total ?? 0;
    const correct = row?.correct ?? 0;
    const wrong = row?.wrong ?? 0;
    return {
      sectionId: section.id,
      section: sectionName(section.id),
      total,
      correct,
      wrong,
      accuracy: correct + wrong > 0 ? round((correct / (correct + wrong)) * 100) : 0,
    };
  });

  const recentAttempts = await hydrateAttempts(recentDocs);
  const mostMissed = await hydrateMissed(missedRows);

  return {
    users: userDocs.filter((user) => user.role === "user").length,
    activeUsers: userDocs.filter((user) => user.role === "user" && user.active).length,
    submittedAttempts: submittedCount,
    inProgressAttempts: inProgressCount,
    fullMocks,
    averagePercent: round(stats?.avgPercent ?? 0),
    averageNet: round(stats?.avgNet ?? 0),
    passRate: fullMocks > 0 ? round(((stats?.passCount ?? 0) / fullMocks) * 100) : 0,
    sections,
    recentAttempts,
    mostMissed,
  };
}

async function hydrateAttempts(docs: AttemptDoc[]): Promise<RecentAttempt[]> {
  if (docs.length === 0) return [];
  const [userDocs, testDocs] = await Promise.all([
    (await users())
      .find({ _id: { $in: docs.map((doc) => doc.userId) } })
      .toArray(),
    (await tests())
      .find({ _id: { $in: docs.map((doc) => doc.testId) } })
      .toArray(),
  ]);
  const userMap = new Map(userDocs.map((user) => [user._id, user]));
  const testMap = new Map(testDocs.map((test) => [test._id, test]));

  return docs.map((attempt) => {
    const user = userMap.get(attempt.userId);
    const test = testMap.get(attempt.testId);
    return {
      id: attempt._id,
      userId: attempt.userId,
      username: user?.username ?? "unknown",
      displayName: user?.displayName ?? "Unknown",
      title: test?.title ?? "Attempt",
      kind: test?.kind ?? "full",
      submittedAt: attempt.submittedAt,
      score: attempt.score?.total ?? 0,
      percent: attempt.score?.percent ?? 0,
    };
  });
}

async function hydrateMissed(
  rows: { _id: string; wrong: number }[],
): Promise<MissedQuestion[]> {
  if (rows.length === 0) return [];
  const docs = await (await questions())
    .find({ _id: { $in: rows.map((row) => row._id) } })
    .toArray();
  const map = new Map(docs.map((doc) => [doc._id, doc]));
  return rows
    .map((row) => {
      const question = map.get(row._id);
      if (!question) return null;
      return {
        questionId: row._id,
        stem: question.stem,
        section: sectionName(question.sectionId),
        wrong: row.wrong,
      };
    })
    .filter((row): row is MissedQuestion => Boolean(row));
}

export interface UserPerformance {
  id: string;
  username: string;
  displayName: string;
  role: "user" | "admin";
  active: boolean;
  createdAt: Date;
  lastLoginAt: Date | null;
  attempts: RecentAttempt[];
  submitted: number;
  inProgress: number;
  fullMocks: number;
  averagePercent: number;
  bestPercent: number;
  averageNet: number;
  bestNet: number | null;
  lastNet: number | null;
  sections: SectionAccuracy[];
  mostMissed: MissedQuestion[];
}

export async function getUserPerformance(
  userId: string,
): Promise<UserPerformance | null> {
  const user = await (await users()).findOne({ _id: userId });
  if (!user) return null;

  const attemptDocs = await (await attempts())
    .find({ userId })
    .sort({ startedAt: -1 })
    .toArray();
  const submittedDocs = attemptDocs.filter((doc) => doc.status === "submitted");

  const testDocs =
    attemptDocs.length === 0
      ? []
      : await (await tests())
          .find({ _id: { $in: attemptDocs.map((doc) => doc.testId) } })
          .toArray();
  const kindById = new Map(testDocs.map((test) => [test._id, test.kind]));
  const fullMocks = submittedDocs.filter(
    (doc) => kindById.get(doc.testId) === "full",
  ).length;

  const avgPercent =
    submittedDocs.length > 0
      ? submittedDocs.reduce((sum, doc) => sum + (doc.score?.percent ?? 0), 0) /
        submittedDocs.length
      : 0;
  const bestPercent =
    submittedDocs.length > 0
      ? Math.max(...submittedDocs.map((doc) => doc.score?.percent ?? 0))
      : 0;
  const avgNet =
    submittedDocs.length > 0
      ? submittedDocs.reduce((sum, doc) => sum + (doc.score?.total ?? 0), 0) /
        submittedDocs.length
      : 0;

  const sectionTotals = new Map<
    string,
    { total: number; correct: number; wrong: number }
  >();
  for (const doc of submittedDocs) {
    for (const section of doc.score?.sections ?? []) {
      const current = sectionTotals.get(section.sectionId) ?? {
        total: 0,
        correct: 0,
        wrong: 0,
      };
      current.total += section.total;
      current.correct += section.correct;
      current.wrong += section.wrong;
      sectionTotals.set(section.sectionId, current);
    }
  }

  const sections: SectionAccuracy[] = EXAM_PATTERN.sections.map((section) => {
    const row = sectionTotals.get(section.id);
    const correct = row?.correct ?? 0;
    const wrong = row?.wrong ?? 0;
    return {
      sectionId: section.id,
      section: sectionName(section.id),
      total: row?.total ?? 0,
      correct,
      wrong,
      accuracy: correct + wrong > 0 ? round((correct / (correct + wrong)) * 100) : 0,
    };
  });

  const missedRows = await (await answers())
    .aggregate<{ _id: string; wrong: number }>([
      { $match: { userId, isCorrect: false } },
      { $group: { _id: "$questionId", wrong: { $sum: 1 } } },
      { $sort: { wrong: -1 } },
      { $limit: 8 },
    ])
    .toArray();

  return {
    id: user._id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    active: user.active,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
    attempts: await hydrateAttempts(submittedDocs.slice(0, 20)),
    submitted: submittedDocs.length,
    inProgress: attemptDocs.length - submittedDocs.length,
    fullMocks,
    averagePercent: round(avgPercent),
    bestPercent: round(bestPercent),
    averageNet: round(avgNet),
    bestNet:
      submittedDocs.length > 0
        ? Math.max(...submittedDocs.map((doc) => doc.score?.total ?? 0))
        : null,
    lastNet: submittedDocs[0] ? (submittedDocs[0].score?.total ?? 0) : null,
    sections,
    mostMissed: await hydrateMissed(missedRows),
  };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
