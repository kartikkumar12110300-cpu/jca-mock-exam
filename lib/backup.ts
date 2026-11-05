import { randomUUID } from "node:crypto";
import { z } from "zod";
import { answers, attempts, questions, tests } from "@/lib/db/collections";
import type { AnswerDoc, AttemptDoc, TestDoc } from "@/lib/db/types";
import { scoreAttempt } from "@/lib/exam/scoring";

export class RestoreError extends Error {}

const dateString = z.string().datetime({ offset: true }).or(z.string().min(1));

const testSchema = z.object({
  title: z.string().max(300),
  kind: z.enum(["full", "drill", "learn"]),
  pattern: z.unknown(),
  durationSec: z.number().int().min(0).max(24 * 60 * 60),
  questionIds: z.array(z.string()).max(500),
  isTemplate: z.boolean().optional(),
  createdAt: dateString,
});

const attemptSchema = z.object({
  testIndex: z.number().int().min(0).max(499),
  startedAt: dateString,
  endsAt: dateString,
  submittedAt: dateString.nullable(),
  status: z.enum(["in_progress", "submitted"]),
  score: z.unknown().nullable(),
  createdAt: dateString,
});

const answerSchema = z.object({
  attemptIndex: z.number().int().min(0).max(499),
  questionId: z.string(),
  selectedIndex: z.number().int().min(0).max(3).nullable(),
  isCorrect: z.boolean().nullable().optional(),
  markedForReview: z.boolean().optional(),
  timeSpentMs: z.number().int().min(0).optional(),
  updatedAt: dateString,
});

export const backupSchema = z.object({
  version: z.literal(1),
  exportedAt: dateString,
  tests: z.array(testSchema).max(500),
  attempts: z.array(attemptSchema).max(500),
  answers: z.array(answerSchema).max(20_000),
});

export type BackupPayload = z.infer<typeof backupSchema>;
export type RestoreMode = "merge" | "replace";

export const restoreModeSchema = z.enum(["merge", "replace"]);

function parseDate(value: string, label: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new RestoreError(`${label} has an invalid date.`);
  }
  return date;
}

function sameInstant(a: Date, b: Date): boolean {
  return Math.abs(a.getTime() - b.getTime()) < 1000;
}

export async function exportUserData(userId: string, username: string) {
  const [testDocs, attemptDocs, answerDocs] = await Promise.all([
    (await tests()).find({ userId }).sort({ createdAt: 1 }).toArray(),
    (await attempts()).find({ userId }).sort({ createdAt: 1 }).toArray(),
    (await answers()).find({ userId }).sort({ updatedAt: 1 }).toArray(),
  ]);

  const testIndex = new Map(testDocs.map((test, index) => [test._id, index]));
  const attemptIndex = new Map(
    attemptDocs.map((attempt, index) => [attempt._id, index]),
  );

  return {
    version: 1 as const,
    exportedAt: new Date().toISOString(),
    username,
    tests: testDocs.map((test) => ({
      title: test.title,
      kind: test.kind,
      pattern: test.pattern,
      durationSec: test.durationSec,
      questionIds: test.questionIds,
      isTemplate: test.isTemplate,
      createdAt: test.createdAt.toISOString(),
    })),
    attempts: attemptDocs.map((attempt) => ({
      testIndex: testIndex.get(attempt.testId) ?? 0,
      startedAt: attempt.startedAt.toISOString(),
      endsAt: attempt.endsAt.toISOString(),
      submittedAt: attempt.submittedAt?.toISOString() ?? null,
      status: attempt.status,
      // Kept for readability only; restore always recalculates the score.
      score: attempt.score,
      createdAt: attempt.createdAt.toISOString(),
    })),
    answers: answerDocs
      .filter((answer) => attemptIndex.has(answer.attemptId))
      .map((answer) => ({
        attemptIndex: attemptIndex.get(answer.attemptId) ?? 0,
        questionId: answer.questionId,
        selectedIndex: answer.selectedIndex,
        isCorrect: answer.isCorrect,
        markedForReview: answer.markedForReview,
        timeSpentMs: answer.timeSpentMs,
        updatedAt: answer.updatedAt.toISOString(),
      })),
  };
}

/**
 * Imports a backup for one user.
 *
 * The uploaded file is treated as untrusted input: scores and `isCorrect`
 * flags are never trusted. Every answer is re-marked against the question bank
 * and every submitted paper is re-scored on the server, so a hand-edited
 * backup cannot inflate the candidate's record or the admin dashboard.
 */
export async function restoreUserData(
  userId: string,
  payload: BackupPayload,
  mode: RestoreMode = "merge",
): Promise<{ tests: number; attempts: number; answers: number; skipped: number }> {
  for (const [index, attempt] of payload.attempts.entries()) {
    if (attempt.testIndex >= payload.tests.length) {
      throw new RestoreError(`Attempt ${index + 1} points at a missing paper.`);
    }
  }

  const referencedQuestions = new Set<string>();
  for (const test of payload.tests) {
    for (const id of test.questionIds) referencedQuestions.add(id);
  }
  for (const answer of payload.answers) referencedQuestions.add(answer.questionId);

  const questionDocs = await (await questions())
    .find({ _id: { $in: [...referencedQuestions] } })
    .toArray();
  const questionMap = new Map(questionDocs.map((question) => [question._id, question]));

  const missing = referencedQuestions.size - questionMap.size;
  if (missing > 0) {
    throw new RestoreError(
      `This backup refers to ${missing} question(s) that are not in the bank. Seed the bank first, then restore again.`,
    );
  }

  if (mode === "replace") {
    await resetUserData(userId);
  }

  const existingTests =
    mode === "merge"
      ? await (await tests())
          .find({ userId })
          .project<{ _id: string; title: string; createdAt: Date }>({
            title: 1,
            createdAt: 1,
          })
          .toArray()
      : [];

  const existingAttempts =
    mode === "merge"
      ? await (await attempts())
          .find({ userId })
          .project<{ testId: string; startedAt: Date }>({ testId: 1, startedAt: 1 })
          .toArray()
      : [];

  const duplicateTests = new Set<number>();
  for (const [index, test] of payload.tests.entries()) {
    const createdAt = parseDate(test.createdAt, `Paper ${index + 1}`);
    const seen = existingTests.some(
      (row) => row.title === test.title && sameInstant(row.createdAt, createdAt),
    );
    if (seen) duplicateTests.add(index);
  }

  const testIds: string[] = payload.tests.map(() => "");
  const testDocs: TestDoc[] = [];

  for (const [index, test] of payload.tests.entries()) {
    if (duplicateTests.has(index)) continue;
    const id = randomUUID();
    testIds[index] = id;
    testDocs.push({
      _id: id,
      userId,
      title: test.title,
      kind: test.kind,
      pattern: test.pattern,
      durationSec: test.durationSec,
      questionIds: test.questionIds,
      isTemplate: test.isTemplate ?? false,
      createdAt: parseDate(test.createdAt, `Paper ${index + 1}`),
    });
  }

  // Answers are re-marked from the bank, never from the file.
  const payloadAnswersByAttempt = new Map<
    number,
    { questionId: string; selectedIndex: number | null }[]
  >();
  for (const answer of payload.answers) {
    const bucket = payloadAnswersByAttempt.get(answer.attemptIndex) ?? [];
    bucket.push({
      questionId: answer.questionId,
      selectedIndex: answer.selectedIndex,
    });
    payloadAnswersByAttempt.set(answer.attemptIndex, bucket);
  }

  const attemptIds: string[] = payload.attempts.map(() => "");
  const attemptDocs: AttemptDoc[] = [];
  const skippedAttempts = new Set<number>();

  for (const [index, attempt] of payload.attempts.entries()) {
    const testIndex = attempt.testIndex;
    const startedAt = parseDate(attempt.startedAt, `Attempt ${index + 1}`);

    if (duplicateTests.has(testIndex)) {
      skippedAttempts.add(index);
      continue;
    }

    const test = payload.tests[testIndex];
    const testId = testIds[testIndex] || "";
    if (!testId || !test) continue;

    const started = startedAt;
    const duplicate = existingAttempts.some(
      (row) =>
        (row.testId === testId || row.testId === testIds[testIndex]) &&
        sameInstant(row.startedAt, started),
    );
    if (duplicate) {
      skippedAttempts.add(index);
      continue;
    }

    const attemptAnswers = payloadAnswersByAttempt.get(index) ?? [];
    const score = scoreAttempt(
      test.questionIds.flatMap((questionId) => {
        const question = questionMap.get(questionId);
        if (!question) return [];
        return [
          {
            questionId: question._id,
            sectionId: question.sectionId,
            correctIndex: question.correctIndex,
            isBonus: question.isBonus,
          },
        ];
      }),
      attemptAnswers,
    );

    const id = randomUUID();
    attemptIds[index] = id;
    const status = attempt.status;
    attemptDocs.push({
      _id: id,
      userId,
      testId,
      startedAt,
      endsAt: parseDate(attempt.endsAt, `Attempt ${index + 1}`),
      submittedAt: attempt.submittedAt
        ? parseDate(attempt.submittedAt, `Attempt ${index + 1}`)
        : null,
      status,
      score: status === "submitted" ? score : null,
      createdAt: parseDate(attempt.createdAt, `Attempt ${index + 1}`),
    });
  }

  const answerDocs: AnswerDoc[] = [];
  for (const [index, answer] of payload.answers.entries()) {
    if (skippedAttempts.has(answer.attemptIndex)) continue;
    const attemptId = attemptIds[answer.attemptIndex];
    if (!attemptId) continue;
    const question = questionMap.get(answer.questionId);
    if (!question) continue;
    const isCorrect =
      answer.selectedIndex === null
        ? null
        : question.isBonus
          ? true
          : question.correctIndex === answer.selectedIndex;

    answerDocs.push({
      _id: randomUUID(),
      attemptId,
      userId,
      questionId: answer.questionId,
      selectedIndex: answer.selectedIndex,
      isCorrect,
      markedForReview: answer.markedForReview ?? false,
      timeSpentMs: answer.timeSpentMs ?? 0,
      updatedAt: parseDate(answer.updatedAt, `Answer ${index + 1}`),
    });
  }

  if (testDocs.length > 0) await (await tests()).insertMany(testDocs);
  if (attemptDocs.length > 0) await (await attempts()).insertMany(attemptDocs);
  if (answerDocs.length > 0) await (await answers()).insertMany(answerDocs);

  return {
    tests: testDocs.length,
    attempts: attemptDocs.length,
    answers: answerDocs.length,
    skipped: duplicateTests.size + skippedAttempts.size,
  };
}

export async function resetUserData(userId: string): Promise<void> {
  await Promise.all([
    (await answers()).deleteMany({ userId }),
    (await attempts()).deleteMany({ userId }),
    (await tests()).deleteMany({ userId }),
  ]);
}
