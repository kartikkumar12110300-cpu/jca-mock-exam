import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { RichText } from "@/components/rich-text";
import { SiteHeader } from "@/components/site-header";
import { requireUser } from "@/lib/auth/session";
import { getAttemptBundle } from "@/lib/attempts";
import { EXAM_PATTERN, getSection, scaledTargets } from "@/lib/pattern";
import { cn, formatDuration, formatPercent, formatScore } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ResultPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ filter?: string }>;
}) {
  const { id } = await params;
  const { filter } = await searchParams;
  const user = await requireUser();
  const bundle = await getAttemptBundle(id, user);

  if (!bundle) notFound();
  if (bundle.attempt.status === "in_progress") redirect(`/attempt/${id}`);

  const { attempt, test, questions, answers } = bundle;
  const score = attempt.score;

  if (!score) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-sm text-muted">
          This attempt has no score yet.{" "}
          <Link href={`/attempt/${id}`} className="underline">
            Return to the paper
          </Link>
          .
        </p>
      </div>
    );
  }

  const answerByQuestion = new Map(answers.map((a) => [a.questionId, a]));
  const wrongOnly = filter === "wrong";
  const visible = wrongOnly
    ? questions.filter((q) => {
        const a = answerByQuestion.get(q.id);
        if (!q.isBonus && a?.selectedIndex != null) return a.selectedIndex !== q.correctIndex;
        return false;
      })
    : questions;

  const isFullMock = test.kind === "full";
  const isLearn = test.kind === "learn";
  const drillPercent =
    test.questionIds.length === 0 ? 0 : Math.max(0, score.net) / test.questionIds.length;

  // A short full mock (bank smaller than the 100-question paper) is judged
  // against proportionally scaled pass/target marks, not the absolute ones.
  const totalPresent = test.questionIds.length;
  const isShort = isFullMock && totalPresent < EXAM_PATTERN.totalQuestions;
  const { pass: scaledPass, target: scaledTarget } = scaledTargets(totalPresent);

  const verdict = isLearn
    ? { label: "Learn session complete", tone: "text-accent" }
    : !isFullMock
      ? drillPercent >= 0.75
        ? { label: "Strong drill", tone: "text-ok" }
        : drillPercent >= 0.5
          ? { label: "Getting there", tone: "text-accent" }
          : { label: "Needs work", tone: "text-bad" }
      : score.net >= scaledTarget
        ? { label: "Above target", tone: "text-ok" }
        : score.net >= scaledPass
          ? { label: "Above pass mark", tone: "text-accent" }
          : { label: "Below pass mark", tone: "text-bad" };

  const spent = attempt.submittedAt
    ? Math.round((attempt.submittedAt.getTime() - attempt.startedAt.getTime()) / 1000)
    : 0;

  return (
    <>
      <SiteHeader />

      <div className="mx-auto max-w-4xl px-6 py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold">Result</h1>
            <span className="font-mono text-xs text-muted">
              {attempt.status === "expired" ? "auto-submitted · time up" : "submitted"}
            </span>
            {isShort ? (
              <span
                className="rounded-full border border-accent/40 bg-accent/10 px-2.5 py-0.5 text-[11px] font-medium text-accent"
                title="This paper used fewer than the 100 questions in the 2026 pattern; pass and target marks are scaled in proportion."
              >
                Short paper · {totalPresent}Q
              </span>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/new"
              className="rounded-md bg-accent px-3.5 py-1.5 text-sm font-semibold text-canvas transition hover:brightness-110"
            >
              Take another mock
            </Link>
            <Link
              href="/"
              className="rounded-md border border-line px-3.5 py-1.5 text-sm text-muted transition hover:text-ink"
            >
              Dashboard
            </Link>
          </div>
        </div>

        <section className="mt-6 rounded-xl border border-line bg-surface p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-widest text-muted">
              {isLearn ? "Correct answers" : "Net score"}
            </div>
            <div className="mt-1 flex items-baseline gap-3">
              <span className={cn("font-mono text-5xl leading-none", isLearn && "text-ok")}>
                {isLearn ? score.correct : formatScore(score.net)}
              </span>
              <span className="text-sm text-muted">/ {test.questionIds.length}</span>
            </div>
            <div className={cn("mt-1 text-sm font-medium", verdict.tone)}>{verdict.label}</div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
            {[
              { label: "Correct", value: String(score.correct), tone: "text-ok" },
              { label: "Wrong", value: String(score.wrong), tone: "text-bad" },
              { label: "Skipped", value: String(score.skipped), tone: "text-muted" },
              { label: "Accuracy", value: formatPercent(score.accuracy), tone: "text-ink" },
            ].map((stat) => (
              <div key={stat.label} className="rounded-lg border border-line bg-surface-2 px-3 py-2">
                <div className="text-[10px] uppercase tracking-widest text-muted">
                  {stat.label}
                </div>
                <div className={cn("font-mono text-lg", stat.tone)}>{stat.value}</div>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-4 text-xs text-muted">
          {formatDuration(spent)} spent · {score.bonus} bonus question(s) ·{" "}
          {isLearn
            ? `${totalPresent}-question learn session · counts towards section mastery`
            : isFullMock
              ? isShort
                ? `pass ≈${scaledPass} · target ≈${scaledTarget} (scaled for ${totalPresent} questions)`
                : `pass ${EXAM_PATTERN.passMark} · target ${EXAM_PATTERN.targetMark}`
              : `${test.questionIds.length}-question drill`}
        </p>
      </section>

      <section className="mt-6 overflow-hidden rounded-xl border border-line bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-widest text-muted">
              <th className="px-4 py-3 font-medium">Section</th>
              <th className="px-4 py-3 text-right font-medium">Correct</th>
              <th className="px-4 py-3 text-right font-medium">Wrong</th>
              <th className="px-4 py-3 text-right font-medium">Skipped</th>
              <th className="px-4 py-3 text-right font-medium">Net</th>
              {isFullMock ? <th className="px-4 py-3 text-right font-medium">Target</th> : null}
            </tr>
          </thead>
          <tbody>
            {score.perSection.map((row) => {
              const config = getSection(row.sectionId);
              // For a short paper, scale each section's target by how many of
              // its questions actually appeared in this paper.
              const sectionTarget =
                config && row.total > 0 && row.total < config.count
                  ? Math.round((config.target * row.total) / config.count)
                  : config?.target;
              return (
                <tr key={row.sectionId} className="border-b border-line/60 last:border-0">
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/drill?section=${row.sectionId}`}
                      className="hover:text-accent hover:underline"
                      title={`Drill ${config?.short ?? row.sectionId}`}
                    >
                      {config?.short ?? row.sectionId}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-ok">{row.correct}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-bad">{row.wrong}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-muted">{row.skipped}</td>
                  <td className="px-4 py-2.5 text-right font-mono">{formatScore(row.net)}</td>
                  {isFullMock ? (
                    <td
                      className={cn(
                        "px-4 py-2.5 text-right font-mono",
                        sectionTarget != null && row.correct >= sectionTarget ? "text-ok" : "text-muted",
                      )}
                    >
                      {sectionTarget ?? "—"}
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">
            Review
          </h2>
          <div className="flex gap-2 text-xs">
            <Link
              href={`/attempt/${id}/result`}
              className={cn(
                "rounded-md border px-2.5 py-1",
                wrongOnly ? "border-line text-muted" : "border-accent/50 bg-accent/10 text-accent",
              )}
            >
              All {questions.length}
            </Link>
            <Link
              href={`/attempt/${id}/result?filter=wrong`}
              className={cn(
                "rounded-md border px-2.5 py-1",
                wrongOnly ? "border-accent/50 bg-accent/10 text-accent" : "border-line text-muted",
              )}
            >
              Wrong {score.wrong}
            </Link>
          </div>
        </div>

        <div className="mt-3 space-y-3">
          {visible.length === 0 ? (
            <p className="rounded-lg border border-line bg-surface px-4 py-6 text-center text-sm text-muted">
              Nothing here. {wrongOnly ? "No wrong answers — that is the goal." : ""}
            </p>
          ) : null}

          {visible.map((q) => {
            const given = answerByQuestion.get(q.id);
            const chosen = given?.selectedIndex ?? null;
            const originalIndex = questions.indexOf(q) + 1;

            return (
              <article key={q.id} className="rounded-xl border border-line bg-surface p-5">
                <div className="flex items-center justify-between text-xs text-muted">
                  <span className="font-mono">
                    Q{originalIndex} · {getSection(q.sectionId)?.short ?? q.sectionId}
                  </span>
                  {q.isBonus ? (
                    <span className="rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[10px] text-accent">
                      bonus — full marks to all
                    </span>
                  ) : null}
                </div>

                <RichText
                  text={q.stem}
                  className="mt-2 block whitespace-pre-wrap text-sm leading-relaxed"
                />

                <ul className="mt-3 space-y-1.5 text-sm">
                  {q.options.map((option, i) => {
                    const isCorrect = !q.isBonus && i === q.correctIndex;
                    const isChosen = i === chosen;
                    return (
                      <li
                        key={i}
                        className={cn(
                          "flex items-start gap-2 rounded-md border px-3 py-2",
                          isCorrect
                            ? "border-ok/50 bg-ok/10"
                            : isChosen
                              ? "border-bad/50 bg-bad/10"
                              : "border-line/60",
                        )}
                      >
                        <span className="font-mono text-xs text-muted">
                          {String.fromCharCode(65 + i)}
                        </span>
                        <span className="flex-1">{option}</span>
                        {isChosen ? <span className="text-[10px] uppercase text-muted">your answer</span> : null}
                      </li>
                    );
                  })}
                </ul>

                {q.explanation ? (
                  <p className="mt-3 border-l-2 border-accent/40 pl-3 text-xs leading-relaxed text-muted">
                    {q.explanation}
                  </p>
                ) : null}

                <div className="mt-2 flex flex-wrap gap-3 text-[10px] uppercase tracking-wider text-muted/70">
                  {q.sourceRef ? <span>{q.sourceRef}</span> : null}
                  <span>{q.sourceType}</span>
                  <span>{q.keyStatus} key</span>
                </div>
              </article>
            );
          })}
        </div>
      </section>
      </div>
    </>
  );
}
