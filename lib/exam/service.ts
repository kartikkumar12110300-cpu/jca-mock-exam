import { randomUUID } from "node:crypto";
import { answers, attempts, questions, tests } from "@/lib/db/collections";
import type { AnswerDoc, AttemptDoc, QuestionDoc, TestDoc } from "@/lib/db/types";
import {
  DRILL_SECONDS_PER_QUESTION,
  EXAM_PATTERN,
  LEARN_MAX_QUESTIONS,
  LEARN_WINDOW_SEC,
  SECTION_IDS,
  TOTAL_QUESTIONS,
  sectionName,
  sectionShort,
  type SectionId,
} from "@/lib/exam/pattern";
import { scoreAttempt } from "@/lib/exam/scoring";
import {
  pickForPattern,
  pickQuestions,
  type Candidate,
  type CandidateHistory,
  type SelectionMode,
} from "@/lib/exam/selection";
import type { CreateAttemptInput } from "@/lib/validation/schemas";

export class BankError extends Error {}

async function historyFor(userId: string): Promise<Map<string, CandidateHistory>> {
  const rows = await (
    await answers()
  )
    .aggregate<{ _id: string; attempts: number; wrong: number }>([
      { $match: { userId } },
      {
        $group: {
          _id: "$questionId",
          attempts: { $sum: 1 },
          wrong: {
            $sum: { $cond: [{ $eq: ["$isCorrect", false] }, 1, 0] },
          },
        },
      },
    ])
    .toArray();

  return new Map(
    rows.map((row) => [row._id, { attempts: row.attempts, wrong: row.wrong }]),
  );
}

async function publishedCandidates(sectionId?: string): Promise<Candidate[]> {
  const filter: Record<string, unknown> = { status: "published" };
  if (sectionId) filter.sectionId = sectionId;
  const docs = await (await questions())
    .find(filter)
    .project<{ _id: string; sectionId: string }>({ sectionId: 1 })
    .toArray();
  return docs.map((doc) => ({ id: doc._id, sectionId: doc.sectionId }));
}

export interface CreatedAttempt {
  attemptId: string;
  testId: string;
}

export async function createAttempt(
  userId: string,
  input: CreateAttemptInput,
): Promise<CreatedAttempt> {
  const history = await historyFor(userId);
  let picked: Candidate[];
  let test: Omit<TestDoc, "_id" | "userId" | "createdAt">;

  if (input.kind === "full") {
    const all = await publishedCandidates();
    const bySection = new Map<string, Candidate[]>();
    for (const candidate of all) {
      const bucket = bySection.get(candidate.sectionId) ?? [];
      bucket.push(candidate);
      bySection.set(candidate.sectionId, bucket);
    }

    for (const quota of EXAM_PATTERN.sections) {
      const available = bySection.get(quota.id)?.length ?? 0;
      if (available < quota.count) {
        throw new BankError(
          `Not enough ${sectionName(quota.id)} questions: need ${quota.count}, have ${available}.`,
        );
      }
    }

    picked = pickForPattern(bySection, EXAM_PATTERN.sections, history);
    if (picked.length !== TOTAL_QUESTIONS) {
      throw new BankError("Could not assemble a complete paper from the bank.");
    }

    test = {
      title: EXAM_PATTERN.title,
      kind: "full",
      pattern: EXAM_PATTERN,
      durationSec: EXAM_PATTERN.durationSec,
      questionIds: picked.map((candidate) => candidate.id),
      isTemplate: false,
    };
  } else if (input.kind === "learn") {
    const candidates = await publishedCandidates(input.sectionId);
    const wanted = Math.min(
      LEARN_MAX_QUESTIONS,
      Math.max(1, input.count ?? LEARN_MAX_QUESTIONS / 2),
    );
    const selected = pickQuestions(candidates, Math.min(wanted, candidates.length), history, "weak");
    if (selected.length === 0) {
      throw new BankError("No questions available for this learn session.");
    }

    const cleanSection = SECTION_IDS.includes(input.sectionId as SectionId)
      ? input.sectionId
      : null;
    const label = cleanSection ? `Learn - ${sectionShort(cleanSection)}` : "Learn - mixed";

    test = {
      title: `${label} - ${selected.length} questions`,
      kind: "learn",
      pattern: {
        kind: "learn",
        label,
        sectionId: cleanSection,
        count: selected.length,
        marking: EXAM_PATTERN.marking,
      },
      // Learn mode has no clock; the runner shows one page at a time.
      durationSec: 0,
      questionIds: selected.map((candidate) => candidate.id),
      isTemplate: false,
    };
  } else {
    const candidates = await publishedCandidates(input.sectionId);
    const selected = pickQuestions(
      candidates,
      Math.min(input.count, candidates.length),
      history,
      input.order as SelectionMode,
    );
    if (selected.length === 0) {
      throw new BankError("No questions available for this drill.");
    }

    const cleanSection = SECTION_IDS.includes(input.sectionId as SectionId)
      ? input.sectionId
      : null;

    test = {
      title: cleanSection
        ? `Drill - ${sectionName(cleanSection)} - ${selected.length} questions`
        : `Drill - All sections - ${selected.length} questions`,
      kind: "drill",
      pattern: {
        kind: "drill",
        sectionId: cleanSection,
        count: selected.length,
        order: input.order,
        marking: EXAM_PATTERN.marking,
      },
      durationSec: selected.length * DRILL_SECONDS_PER_QUESTION,
      questionIds: selected.map((candidate) => candidate.id),
      isTemplate: false,
    };
  }

  const testId = randomUUID();
  const attemptId = randomUUID();
  const now = new Date();

  await (await tests()).insertOne({
    _id: testId,
    userId,
    ...test,
    createdAt: now,
  });

  // Learn sessions stay resumable for a month; a real paper ends with its clock.
  const windowSec = test.kind === "learn" ? LEARN_WINDOW_SEC : test.durationSec;

  await (await attempts()).insertOne({
    _id: attemptId,
    userId,
    testId,
    startedAt: now,
    endsAt: new Date(now.getTime() + windowSec * 1000),
    submittedAt: null,
    status: "in_progress",
    score: null,
    createdAt: now,
  });

  return { attemptId, testId };
}

export async function submitAttempt(
  attemptId: string,
  userId: string,
): Promise<AttemptDoc | null> {
  const attempt = await (await attempts()).findOne({ _id: attemptId, userId });
  if (!attempt) return null;
  if (attempt.status === "submitted") return attempt;

  const test = await (await tests()).findOne({ _id: attempt.testId });
  if (!test) return null;

  const questionDocs = await (await questions())
    .find({ _id: { $in: test.questionIds } })
    .toArray();
  const answerDocs = await (await answers()).find({ attemptId }).toArray();

  const score = scoreAttempt(
    questionDocs.map((question) => ({
      questionId: question._id,
      sectionId: question.sectionId,
      correctIndex: question.correctIndex,
      isBonus: question.isBonus,
    })),
    answerDocs.map((answer) => ({
      questionId: answer.questionId,
      selectedIndex: answer.selectedIndex,
    })),
  );

  const submittedAt = new Date();
  await (await attempts()).updateOne(
    { _id: attemptId, userId, status: "in_progress" },
    { $set: { status: "submitted", score, submittedAt } },
  );

  return {
    ...attempt,
    status: "submitted",
    score,
    submittedAt,
  };
}

export interface AttemptView {
  attempt: AttemptDoc;
  test: TestDoc;
  questions: QuestionDoc[];
  answers: AnswerDoc[];
}

export async function getAttemptForUser(
  attemptId: string,
  userId: string,
): Promise<AttemptView | null> {
  let attempt = await (await attempts()).findOne({ _id: attemptId, userId });
  if (!attempt) return null;

  if (attempt.status === "in_progress" && attempt.endsAt.getTime() <= Date.now()) {
    const submitted = await submitAttempt(attemptId, userId);
    if (submitted) attempt = submitted;
  }

  const test = await (await tests()).findOne({ _id: attempt.testId });
  if (!test) return null;

  const questionDocs = await (await questions())
    .find({ _id: { $in: test.questionIds } })
    .toArray();
  const byId = new Map(questionDocs.map((question) => [question._id, question]));
  const ordered = test.questionIds
    .map((id) => byId.get(id))
    .filter((question): question is QuestionDoc => Boolean(question));

  const answerDocs = await (await answers()).find({ attemptId }).toArray();

  return { attempt, test, questions: ordered, answers: answerDocs };
}

export async function saveAnswer(
  attemptId: string,
  userId: string,
  input: {
    questionId: string;
    selectedIndex: number | null;
    markedForReview?: boolean;
    timeSpentMs?: number;
  },
): Promise<
  | { ok: true; answer: AnswerDoc }
  | {
      ok: false;
      reason: "not_found" | "submitted" | "expired" | "invalid_question" | "locked";
    }
> {
  const attempt = await (await attempts()).findOne({ _id: attemptId, userId });
  if (!attempt) return { ok: false, reason: "not_found" };
  if (attempt.status === "submitted") return { ok: false, reason: "submitted" };

  if (attempt.endsAt.getTime() <= Date.now()) {
    await submitAttempt(attemptId, userId);
    return { ok: false, reason: "expired" };
  }

  const test = await (await tests()).findOne({ _id: attempt.testId });
  if (!test || !test.questionIds.includes(input.questionId)) {
    return { ok: false, reason: "invalid_question" };
  }

  const question = await (await questions()).findOne({ _id: input.questionId });
  if (!question) return { ok: false, reason: "invalid_question" };

  // In learn mode the answer key is shown the moment an option is picked, so
  // the choice must be final. Otherwise a learner could reveal the key and then
  // switch to the right option.
  if (test.kind === "learn") {
    const existing = await (await answers()).findOne({
      attemptId,
      questionId: input.questionId,
    });
    if (existing && existing.selectedIndex !== null) {
      return { ok: false, reason: "locked" };
    }
  }

  const isCorrect =
    input.selectedIndex === null
      ? null
      : question.isBonus
        ? true
        : question.correctIndex === input.selectedIndex;
  const updatedAt = new Date();

  await (await answers()).updateOne(
    { attemptId, questionId: input.questionId },
    {
      $set: {
        selectedIndex: input.selectedIndex,
        isCorrect,
        markedForReview: input.markedForReview ?? false,
        timeSpentMs: input.timeSpentMs ?? 0,
        updatedAt,
      },
      $setOnInsert: {
        _id: randomUUID(),
        attemptId,
        userId,
        questionId: input.questionId,
      },
    },
    { upsert: true },
  );

  const answer = await (await answers()).findOne({
    attemptId,
    questionId: input.questionId,
  });

  if (!answer) return { ok: false, reason: "not_found" };
  return { ok: true, answer };
}
