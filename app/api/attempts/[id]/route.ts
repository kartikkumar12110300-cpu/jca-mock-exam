import { getApiUser } from "@/lib/auth/guards";
import { getAttemptForUser } from "@/lib/exam/service";
import { failure, json, serverFailure } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getApiUser();
    if (!user) return failure("Authentication required", 401);

    const { id } = await context.params;
    const view = await getAttemptForUser(id, user.id);
    if (!view) return failure("Attempt not found", 404);

    // Learn mode reveals the key immediately; a mock or drill only after submit.
    const revealKey =
      view.attempt.status === "submitted" || view.test.kind === "learn";
    return json({
      ok: true,
      attempt: {
        id: view.attempt._id,
        status: view.attempt.status,
        startedAt: view.attempt.startedAt,
        endsAt: view.attempt.endsAt,
        submittedAt: view.attempt.submittedAt,
        score: view.attempt.score,
      },
      test: {
        id: view.test._id,
        title: view.test.title,
        kind: view.test.kind,
        durationSec: view.test.durationSec,
      },
      questions: view.questions.map((question) => ({
        id: question._id,
        sectionId: question.sectionId,
        topic: question.topic,
        difficulty: question.difficulty,
        stem: question.stem,
        options: question.options,
        ...(revealKey
          ? {
              correctIndex: question.correctIndex,
              explanation: question.explanation,
              isBonus: question.isBonus,
              keyStatus: question.keyStatus,
              sourceRef: question.sourceRef,
            }
          : {}),
      })),
      answers: view.answers.map((answer) => ({
        questionId: answer.questionId,
        selectedIndex: answer.selectedIndex,
        markedForReview: answer.markedForReview,
        timeSpentMs: answer.timeSpentMs,
      })),
    });
  } catch (error) {
    return serverFailure(error);
  }
}
