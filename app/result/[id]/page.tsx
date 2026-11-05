import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Badge, Card, PageHeader, ProgressBar, StatCard } from "@/components/ui";
import { requireUser } from "@/lib/auth/guards";
import {
  scaledTargets,
  sectionName,
  verdictFor,
  verdictLabel,
} from "@/lib/exam/pattern";
import { getAttemptForUser } from "@/lib/exam/service";
import { formatDateTime, formatMarks, formatPercent } from "@/lib/utils";

export const dynamic = "force-dynamic";

const VERDICT_TONE = {
  target: "green",
  pass: "amber",
  below: "red",
} as const;

export default async function ResultPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const view = await getAttemptForUser(id, user.id);
  if (!view) notFound();
  if (view.attempt.status !== "submitted") redirect(`/attempt/${id}`);

  const score = view.attempt.score;
  if (!score) notFound();

  const answerMap = new Map(view.answers.map((answer) => [answer.questionId, answer]));
  const verdict = verdictFor(score.total, score.max);
  const { pass, target } = scaledTargets(score.max);
  const attempted = score.correct + score.wrong;
  const isLearn = view.test.kind === "learn";

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={isLearn ? "Learn session" : "Result"}
        title={view.test.title}
        description={`Submitted ${formatDateTime(view.attempt.submittedAt)} · ${score.max} questions · ${
          isLearn ? "no clock" : `${Math.round(view.test.durationSec / 60)} minutes`
        }`}
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/history"
              className="rounded-md border border-line px-4 py-2 text-sm text-muted transition hover:border-accent/50 hover:text-ink"
            >
              History
            </Link>
            <Link
              href={isLearn ? "/learn" : "/new"}
              className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-canvas transition hover:brightness-110"
            >
              {isLearn ? "Another learn set" : "New mock"}
            </Link>
          </div>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="border-accent/30 bg-surface-2 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-widest text-accent">
                Net score
              </p>
              <p className="mt-2 font-mono text-4xl leading-none">
                {formatMarks(score.total)}
                <span className="text-lg text-muted"> / {score.max}</span>
              </p>
            </div>
            <Badge tone={VERDICT_TONE[verdict]}>{verdictLabel(verdict)}</Badge>
          </div>
          <p className="mt-3 text-xs text-muted">
            {formatPercent(score.percent)} · pass {pass} · target {target}
            {score.max < 100 ? " (scaled to paper size)" : ""}
          </p>
          <div className="mt-3">
            <ProgressBar value={score.percent} />
          </div>
        </Card>
        <StatCard label="Correct" value={score.correct} hint={`${attempted} attempted`} />
        <StatCard label="Wrong" value={score.wrong} hint="−0.25 each" />
        <StatCard
          label="Skipped"
          value={score.skipped}
          hint={score.bonus > 0 ? `${score.bonus} bonus question(s)` : "No penalty"}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <Card className="p-0">
          <div className="border-b border-line px-5 py-4">
            <h2 className="text-sm font-semibold">Section breakdown</h2>
            <p className="text-xs text-muted">Net marks and accuracy by section</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-2 text-[11px] uppercase tracking-widest text-muted">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Section</th>
                  <th className="px-4 py-2.5 text-right font-medium">Net</th>
                  <th className="px-4 py-2.5 text-right font-medium">C</th>
                  <th className="px-4 py-2.5 text-right font-medium">W</th>
                  <th className="px-4 py-2.5 text-right font-medium">Skip</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {score.sections.map((section) => (
                  <tr key={section.sectionId}>
                    <td className="px-4 py-2.5">
                      {sectionName(section.sectionId)}
                      {section.bonus > 0 ? (
                        <span className="ml-2 text-[10px] font-medium text-accent">bonus</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono">
                      {formatMarks(section.net)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-ok">
                      {section.correct}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-bad">
                      {section.wrong}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-muted">
                      {section.skipped}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <h2 className="text-sm font-semibold">How to read this result</h2>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-muted">
            <li>
              · <span className="text-ink">Net</span> is the marks left after the 0.25 penalty
              for each wrong answer.
            </li>
            <li>
              · <span className="text-ink">Skipped</span> questions cost nothing. A blind guess
              costs 0.25 on average.
            </li>
            <li>· Bonus questions award +1 to everyone, regardless of the option chosen.</li>
            <li>
              · Short papers are judged against scaled targets, so a 20-question drill is not
              compared with the full 100-mark paper.
            </li>
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/mistakes"
              className="rounded-md border border-line px-4 py-2 text-sm text-muted transition hover:border-accent/50 hover:text-ink"
            >
              Open mistake notebook
            </Link>
            <Link
              href="/drill"
              className="rounded-md border border-line px-4 py-2 text-sm text-muted transition hover:border-accent/50 hover:text-ink"
            >
              Start a drill
            </Link>
          </div>
        </Card>
      </div>

      <section>
        <div className="mb-4">
          <h2 className="text-lg font-semibold tracking-tight">Question review</h2>
          <p className="text-sm text-muted">
            Correct answers and explanations for all {score.max} questions.
          </p>
        </div>

        <ol className="space-y-4">
          {view.questions.map((question, index) => {
            const answer = answerMap.get(question._id);
            const selected = answer?.selectedIndex ?? null;
            const isCorrect =
              selected !== null && (question.isBonus || selected === question.correctIndex);
            const isWrong = selected !== null && !isCorrect;
            const skipped = selected === null;

            return (
              <li key={question._id}>
                <Card>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="grid size-6 place-items-center rounded-md border border-line bg-surface-2 font-mono text-xs text-muted">
                      {index + 1}
                    </span>
                    <Badge tone="blue">{sectionName(question.sectionId)}</Badge>
                    {question.topic ? <Badge>{question.topic}</Badge> : null}
                    {question.isBonus ? <Badge tone="green">Bonus</Badge> : null}
                    <span className="ml-auto">
                      {isCorrect ? (
                        <Badge tone="green">Correct</Badge>
                      ) : isWrong ? (
                        <Badge tone="red">Wrong</Badge>
                      ) : (
                        <Badge>Skipped</Badge>
                      )}
                    </span>
                  </div>

                  <p className="mt-3 whitespace-pre-line text-sm leading-6">
                    {question.stem}
                  </p>

                  <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
                    {question.options.map((option, optionIndex) => {
                      const correct = question.correctIndex === optionIndex;
                      const chosen = selected === optionIndex;
                      return (
                        <li
                          key={optionIndex}
                          className={
                            correct
                              ? "rounded-md border border-ok/50 bg-ok/10 px-3 py-2 text-sm"
                              : chosen
                                ? "rounded-md border border-bad/50 bg-bad/10 px-3 py-2 text-sm"
                                : "rounded-md border border-line px-3 py-2 text-sm text-muted"
                          }
                        >
                          <span className="mr-2 font-mono text-xs text-muted">
                            {String.fromCharCode(65 + optionIndex)}
                          </span>
                          {option}
                          {correct ? (
                            <span className="ml-2 text-xs font-medium text-ok">correct</span>
                          ) : null}
                          {chosen ? (
                            <span className="ml-2 text-xs font-medium">your answer</span>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>

                  {question.explanation ? (
                    <div className="mt-3 border-l-2 border-accent/40 pl-3">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted">
                        Explanation
                      </p>
                      <p className="mt-1 text-sm leading-6 text-muted">
                        {question.explanation}
                      </p>
                    </div>
                  ) : null}

                  <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-muted">
                    {question.sourceRef ? <span>Source {question.sourceRef}</span> : null}
                    <span>Key: {question.keyStatus}</span>
                    {skipped ? <span>Not answered</span> : null}
                  </div>
                </Card>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
