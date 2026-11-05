import { answers, attempts, questions, tests } from "@/lib/db/collections";
import type { AttemptDoc, QuestionDoc } from "@/lib/db/types";
import { SECTIONS, sectionName } from "@/lib/exam/pattern";

export interface AttemptSummary {
  id: string;
  title: string;
  kind: string;
  status: "in_progress" | "submitted";
  startedAt: Date;
  endsAt: Date;
  submittedAt: Date | null;
  /** Net marks after the 0.25 penalty. */
  score: number;
  /** Net marks as a percentage of the paper's maximum. */
  percent: number;
  correct: number;
  wrong: number;
  skipped: number;
  /** Questions in this paper — the honest denominator for short mocks. */
  max: number;
}

export async function listAttempts(
  userId: string,
  limit = 100,
): Promise<AttemptSummary[]> {
  const docs = await (await attempts())
    .find({ userId })
    .sort({ startedAt: -1 })
    .limit(limit)
    .toArray();
  return hydrate(docs);
}

async function hydrate(docs: AttemptDoc[]): Promise<AttemptSummary[]> {
  if (docs.length === 0) return [];
  const testDocs = await (await tests())
    .find({ _id: { $in: docs.map((doc) => doc.testId) } })
    .toArray();
  const testMap = new Map(testDocs.map((test) => [test._id, test]));

  return docs.map((attempt) => {
    const test = testMap.get(attempt.testId);
    return {
      id: attempt._id,
      title: test?.title ?? "Attempt",
      kind: test?.kind ?? "full",
      status: attempt.status,
      startedAt: attempt.startedAt,
      endsAt: attempt.endsAt,
      submittedAt: attempt.submittedAt,
      score: attempt.score?.total ?? 0,
      percent: attempt.score?.percent ?? 0,
      correct: attempt.score?.correct ?? 0,
      wrong: attempt.score?.wrong ?? 0,
      skipped: attempt.score?.skipped ?? 0,
      max: attempt.score?.max ?? test?.questionIds.length ?? 0,
    };
  });
}

export interface SectionMastery {
  sectionId: string;
  section: string;
  accuracy: number;
  correct: number;
  wrong: number;
  /** Questions attempted (correct + wrong). */
  attempted: number;
  /** Questions put in front of the candidate. */
  total: number;
}

export interface DashboardData {
  submitted: number;
  inProgress: number;
  /** Mean net marks across submitted papers. */
  averageNet: number;
  bestNet: number | null;
  lastNet: number | null;
  lastAt: Date | null;
  studyMinutes: number;
  totalQuestions: number;
  bankCounts: Record<string, number>;
  recent: AttemptSummary[];
  /** Oldest to newest, for the trend strip. */
  trend: AttemptSummary[];
  sections: SectionMastery[];
}

export async function getDashboard(userId: string): Promise<DashboardData> {
  const [attemptDocs, bankRows, timeRows] = await Promise.all([
    (await attempts()).find({ userId }).sort({ startedAt: -1 }).toArray(),
    (await questions())
      .aggregate<{ _id: string; count: number }>([
        { $match: { status: "published" } },
        { $group: { _id: "$sectionId", count: { $sum: 1 } } },
      ])
      .toArray(),
    (await answers())
      .aggregate<{ _id: null; total: number }>([
        { $match: { userId } },
        { $group: { _id: null, total: { $sum: "$timeSpentMs" } } },
      ])
      .toArray(),
  ]);

  const submittedDocs = attemptDocs.filter((doc) => doc.status === "submitted");
  const averageNet =
    submittedDocs.length > 0
      ? submittedDocs.reduce((sum, doc) => sum + (doc.score?.total ?? 0), 0) /
        submittedDocs.length
      : 0;
  const bestNet =
    submittedDocs.length > 0
      ? Math.max(...submittedDocs.map((doc) => doc.score?.total ?? 0))
      : null;
  const last = submittedDocs[0] ?? null;

  const sectionTotals = new Map<string, { correct: number; wrong: number; total: number }>();
  for (const doc of submittedDocs) {
    for (const section of doc.score?.sections ?? []) {
      const current = sectionTotals.get(section.sectionId) ?? {
        correct: 0,
        wrong: 0,
        total: 0,
      };
      current.correct += section.correct;
      current.wrong += section.wrong;
      current.total += section.total;
      sectionTotals.set(section.sectionId, current);
    }
  }

  const bankCounts = Object.fromEntries(bankRows.map((row) => [row._id, row.count]));

  return {
    submitted: submittedDocs.length,
    inProgress: attemptDocs.length - submittedDocs.length,
    averageNet: round(averageNet),
    bestNet,
    lastNet: last ? (last.score?.total ?? 0) : null,
    lastAt: last?.submittedAt ?? last?.startedAt ?? null,
    studyMinutes: Math.round((timeRows[0]?.total ?? 0) / 60000),
    totalQuestions: bankRows.reduce((sum, row) => sum + row.count, 0),
    bankCounts,
    recent: await hydrate(attemptDocs.slice(0, 6)),
    trend: (await hydrate(submittedDocs.slice(0, 14))).reverse(),
    // Every section is listed, even untouched ones, so the gaps are visible.
    sections: SECTIONS.map((section) => {
      const row = sectionTotals.get(section.id) ?? { correct: 0, wrong: 0, total: 0 };
      const attempted = row.correct + row.wrong;
      return {
        sectionId: section.id,
        section: sectionName(section.id),
        accuracy: attempted > 0 ? round((row.correct / attempted) * 100) : 0,
        correct: row.correct,
        wrong: row.wrong,
        attempted,
        total: row.total,
      };
    }),
  };
}

export async function getSectionCounts(): Promise<Record<string, number>> {
  const rows = await (await questions())
    .aggregate<{ _id: string; count: number }>([
      { $match: { status: "published" } },
      { $group: { _id: "$sectionId", count: { $sum: 1 } } },
    ])
    .toArray();

  return Object.fromEntries(rows.map((row) => [row._id, row.count]));
}

export interface MistakeItem {
  questionId: string;
  section: string;
  topic: string;
  stem: string;
  options: string[];
  selectedIndex: number | null;
  correctIndex: number | null;
  explanation: string;
  lastAttemptAt: Date;
}

/**
 * The mistake notebook shows a question only while its *latest* answer is
 * wrong. Answering it correctly in a later paper clears it — so the notebook
 * shrinks as the candidate improves instead of growing forever.
 */
export async function listMistakes(userId: string): Promise<MistakeItem[]> {
  const rows = await (await answers())
    .aggregate<{
      _id: string;
      isCorrect: boolean | null;
      selectedIndex: number | null;
      lastAt: Date;
    }>([
      { $match: { userId } },
      { $sort: { updatedAt: -1 } },
      {
        $group: {
          _id: "$questionId",
          isCorrect: { $first: "$isCorrect" },
          selectedIndex: { $first: "$selectedIndex" },
          lastAt: { $first: "$updatedAt" },
        },
      },
      { $match: { isCorrect: false } },
      { $sort: { lastAt: -1 } },
      { $limit: 100 },
    ])
    .toArray();

  if (rows.length === 0) return [];
  const docs = await (await questions())
    .find({ _id: { $in: rows.map((row) => row._id) } })
    .toArray();
  const map = new Map(docs.map((doc) => [doc._id, doc]));

  return rows
    .map((row) => {
      const question = map.get(row._id);
      if (!question) return null;
      return toMistake(question, row.selectedIndex, row.lastAt);
    })
    .filter((item): item is MistakeItem => Boolean(item));
}

function toMistake(
  question: QuestionDoc,
  selectedIndex: number | null,
  lastAt: Date,
): MistakeItem {
  return {
    questionId: question._id,
    section: sectionName(question.sectionId),
    topic: question.topic,
    stem: question.stem,
    options: question.options,
    selectedIndex,
    correctIndex: question.correctIndex,
    explanation: question.explanation,
    lastAttemptAt: lastAt,
  };
}

export interface BankFilters {
  section?: string;
  topic?: string;
  search?: string;
  page: number;
  pageSize: number;
}

export interface BankResult {
  items: QuestionDoc[];
  total: number;
  page: number;
  pageSize: number;
  topics: string[];
}

export async function listBank(filters: BankFilters): Promise<BankResult> {
  const query: Record<string, unknown> = { status: "published" };
  if (filters.section) query.sectionId = filters.section;
  if (filters.topic) query.topic = filters.topic;
  if (filters.search) {
    const escaped = filters.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    query.$or = [
      { stem: { $regex: escaped, $options: "i" } },
      { topic: { $regex: escaped, $options: "i" } },
      { tags: { $regex: escaped, $options: "i" } },
    ];
  }

  const page = Math.max(1, filters.page);
  const pageSize = Math.min(50, Math.max(5, filters.pageSize));
  const collection = await questions();
  const [items, total, topics] = await Promise.all([
    collection
      .find(query)
      .sort({ sectionId: 1, topic: 1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .toArray(),
    collection.countDocuments(query),
    collection.distinct("topic", { status: "published" }),
  ]);

  return {
    items,
    total,
    page,
    pageSize,
    topics: (topics as string[]).filter(Boolean).sort(),
  };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
