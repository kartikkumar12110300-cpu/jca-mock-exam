import Link from "next/link";
import { redirect } from "next/navigation";
import { and, desc, eq, gt, sql } from "drizzle-orm";
import { SiteHeader } from "@/components/site-header";
import { requireUser } from "@/lib/auth/session";
import { createFullMock } from "@/lib/attempts";
import { db } from "@/lib/db";
import { attempts, questions } from "@/lib/db/schema";
import { EXAM_PATTERN } from "@/lib/pattern";
import { formatDuration } from "@/lib/utils";

export const dynamic = "force-dynamic";

async function startFullMock() {
  "use server";
  const user = await requireUser();
  const attemptId = await createFullMock(user.id);
  redirect(`/attempt/${attemptId}`);
}

export default async function NewAttemptPage() {
  const user = await requireUser();

  const resumable = await db
    .select()
    .from(attempts)
    .where(
      and(
        eq(attempts.userId, user.id),
        eq(attempts.status, "in_progress"),
        gt(attempts.endsAt, new Date()),
      ),
    )
    .orderBy(desc(attempts.startedAt))
    .get();

  const counts = await db
    .select({ sectionId: questions.sectionId, n: sql<number>`count(*)` })
    .from(questions)
    .where(eq(questions.status, "published"))
    .groupBy(questions.sectionId)
    .all();

  const availableBySection = new Map(counts.map((c) => [c.sectionId, Number(c.n)]));
  const availableTotal = counts.reduce((sum, c) => sum + Number(c.n), 0);

  const rules = [
    `The 2026 pattern asks for ${EXAM_PATTERN.totalQuestions} questions across ${EXAM_PATTERN.sections.length} sections`,
    `${formatDuration(EXAM_PATTERN.durationSec)} — the paper auto-submits when the clock hits zero`,
    `+${EXAM_PATTERN.marking.correct} for a correct answer, ${EXAM_PATTERN.marking.wrong} for a wrong one, nothing for a skip`,
    "Answers save continuously — refreshing or closing the tab will not lose them",
    `Pass mark ${EXAM_PATTERN.passMark}. Comfortable target ${EXAM_PATTERN.targetMark}.`,
  ];

  return (
    <>
      <SiteHeader />

      <div className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-2xl font-semibold">Full mock exam</h1>
        <p className="mt-1 text-sm text-muted">
          Simulates the real paper: 2026 pattern, real timing, negative marking.
        </p>

        <div className="mt-6 rounded-xl border border-line bg-surface p-6">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">
            Before you begin
          </h2>
          <ul className="mt-3 space-y-2 text-sm">
            {rules.map((rule) => (
              <li key={rule} className="flex gap-2.5">
                <span className="mt-1 size-1.5 shrink-0 rounded-full bg-accent" />
                <span>{rule}</span>
              </li>
            ))}
          </ul>

          {availableTotal < EXAM_PATTERN.totalQuestions ? (
            <p className="mt-4 rounded-lg border border-accent/30 bg-accent/5 px-3 py-2 text-xs leading-relaxed text-accent">
              The bank currently holds {availableTotal} of {EXAM_PATTERN.totalQuestions}{" "}
              questions. This paper will use all {availableTotal} — sections fill up as
              more questions are added.
            </p>
          ) : null}

          <p className="mt-3 text-xs leading-relaxed text-muted">
            Every paper is composed fresh from the {availableTotal}-question bank:
            questions you have not seen yet are picked first, then the ones you answered
            wrong, with a random draw so no two papers are the same.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-line pt-5">
            <form action={startFullMock}>
              <button
                type="submit"
                className="rounded-md bg-accent px-5 py-2.5 text-sm font-semibold text-canvas transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                Start paper
              </button>
            </form>

            {resumable ? (
              <Link
                href={`/attempt/${resumable.id}`}
                className="rounded-md border border-line px-4 py-2.5 text-sm text-muted transition hover:border-accent/50 hover:text-ink"
              >
                Resume attempt in progress
              </Link>
            ) : null}
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {EXAM_PATTERN.sections.map((section) => {
            const have = availableBySection.get(section.id) ?? 0;
            return (
              <div
                key={section.id}
                className="flex items-center justify-between rounded-lg border border-line bg-surface px-4 py-3 text-sm"
              >
                <span>{section.short}</span>
                <span className="font-mono text-muted">
                  <span className={have >= section.count ? "text-ok" : ""}>{have}</span>
                  {" / "}
                  {section.count}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
