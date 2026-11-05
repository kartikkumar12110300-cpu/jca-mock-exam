import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { LearnRunner } from "@/components/learn-runner";
import { requireUser } from "@/lib/auth/guards";
import { LEARN_PAGE_SIZE, sectionShort } from "@/lib/exam/pattern";
import { getAttemptForUser } from "@/lib/exam/service";

export const dynamic = "force-dynamic";

export default async function LearnSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const view = await getAttemptForUser(id, user.id);
  if (!view || view.test.kind !== "learn") notFound();
  if (view.attempt.status === "submitted") redirect(`/result/${id}`);

  const saved: Record<string, number | null> = {};
  for (const answer of view.answers) saved[answer.questionId] = answer.selectedIndex;

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <Link
        href="/learn"
        className="mb-4 inline-block text-xs text-muted transition hover:text-ink"
      >
        ← Back to learn mode
      </Link>
      <LearnRunner
        attemptId={view.attempt._id}
        pageSize={LEARN_PAGE_SIZE}
        questions={view.questions.map((question) => ({
          id: question._id,
          sectionShort: sectionShort(question.sectionId),
          topic: question.topic,
          stem: question.stem,
          options: question.options,
          correctIndex: question.correctIndex,
          isBonus: question.isBonus,
          explanation: question.explanation,
          sourceRef: question.sourceRef,
        }))}
        saved={saved}
      />
    </main>
  );
}
