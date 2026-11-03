import { notFound, redirect } from "next/navigation";
import { getAttemptBundle } from "@/lib/attempts";
import { getSection } from "@/lib/pattern";
import type { RunnerPayload, RunnerSection } from "@/lib/runner-types";
import Runner from "./runner";

export const dynamic = "force-dynamic";

function buildSections(questions: RunnerPayload["questions"]): RunnerSection[] {
  const out: RunnerSection[] = [];
  let i = 0;

  while (i < questions.length) {
    const sectionId = questions[i].sectionId;
    let end = i;
    while (end < questions.length && questions[end].sectionId === sectionId) end += 1;

    const config = getSection(sectionId);
    out.push({
      id: sectionId,
      name: config?.name ?? sectionId,
      short: config?.short ?? sectionId,
      count: end - i,
      start: i,
      end,
    });

    i = end;
  }

  return out;
}

export default async function AttemptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const bundle = getAttemptBundle(id);

  if (!bundle) notFound();
  // Learn sessions have their own instant-feedback runner.
  if (bundle.test.kind === "learn") redirect(`/learn/${id}`);
  if (bundle.attempt.status !== "in_progress") {
    redirect(`/attempt/${id}/result`);
  }

  const saved: RunnerPayload["saved"] = {};
  for (const answer of bundle.answers) {
    saved[answer.questionId] = {
      selectedIndex: answer.selectedIndex,
      markedForReview: answer.markedForReview,
    };
  }

  const payload: RunnerPayload = {
    attemptId: bundle.attempt.id,
    endsAt: bundle.attempt.endsAt.getTime(),
    serverNow: Date.now(),
    durationSec: bundle.test.durationSec,
    marking: bundle.test.pattern.marking,
    sections: buildSections(
      bundle.questions.map((q) => ({
        id: q.id,
        sectionId: q.sectionId,
        stem: q.stem,
        options: q.options,
        isBonus: q.isBonus,
      })),
    ),
    questions: bundle.questions.map((q) => ({
      id: q.id,
      sectionId: q.sectionId,
      stem: q.stem,
      options: q.options,
      isBonus: q.isBonus,
    })),
    saved,
  };

  return <Runner payload={payload} />;
}
