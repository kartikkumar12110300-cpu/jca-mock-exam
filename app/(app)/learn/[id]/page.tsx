import { notFound, redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { requireUser } from "@/lib/auth/session";
import { getLearnBundle, LEARN_PAGE_SIZE } from "@/lib/learn";
import type { LearnPayload } from "@/lib/learn-types";
import { getSection } from "@/lib/pattern";
import LearnRunner from "./learn-runner";

export const dynamic = "force-dynamic";

export default async function LearnSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const bundle = await getLearnBundle(id, user);

  if (!bundle) notFound();
  if (bundle.attempt.status !== "in_progress") {
    redirect(`/attempt/${id}/result`);
  }

  const saved: LearnPayload["saved"] = {};
  for (const answer of bundle.answers) {
    saved[answer.questionId] = answer.selectedIndex;
  }

  const payload: LearnPayload = {
    attemptId: id,
    pageSize: LEARN_PAGE_SIZE,
    questions: bundle.questions.map((q) => ({
      id: q.id,
      sectionId: q.sectionId,
      sectionShort: getSection(q.sectionId)?.short ?? q.sectionId,
      stem: q.stem,
      options: q.options,
      correctIndex: q.correctIndex,
      explanation: q.explanation,
      sourceRef: q.sourceRef,
      isBonus: q.isBonus,
    })),
    saved,
  };

  return (
    <>
      <SiteHeader />
      <LearnRunner payload={payload} />
    </>
  );
}
