import { getApiUser } from "@/lib/auth/guards";
import { saveAnswer } from "@/lib/exam/service";
import { failure, json, serverFailure } from "@/lib/http";
import { parseBody } from "@/lib/validation/parse";
import { answerSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getApiUser();
    if (!user) return failure("Authentication required", 401);

    const { id } = await context.params;
    const parsed = await parseBody(request, answerSchema);
    if (!parsed.ok) return parsed.response;

    const result = await saveAnswer(id, user.id, parsed.data);
    if (!result.ok) {
      const status =
        result.reason === "not_found"
          ? 404
          : result.reason === "invalid_question"
            ? 422
            : 409;
      const message =
        result.reason === "expired"
          ? "Time is up. The paper was submitted."
          : result.reason === "submitted"
            ? "This paper is already submitted."
            : result.reason === "locked"
              ? "This answer is locked. Move on to the next question."
              : result.reason === "invalid_question"
                ? "Question does not belong to this paper."
                : "Attempt not found";
      return failure(message, status);
    }

    return json({
      ok: true,
      answer: {
        questionId: result.answer.questionId,
        selectedIndex: result.answer.selectedIndex,
        markedForReview: result.answer.markedForReview,
        timeSpentMs: result.answer.timeSpentMs,
      },
    });
  } catch (error) {
    return serverFailure(error);
  }
}
