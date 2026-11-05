import Link from "next/link";
import { StartMockButton } from "@/components/start-mock-button";
import { PageHeader, ProgressBar, StatCard } from "@/components/ui";
import { requireUser } from "@/lib/auth/guards";
import { getDashboard } from "@/lib/exam/queries";
import { EXAM_PATTERN, sectionShort, verdictFor } from "@/lib/exam/pattern";
import { cn, formatDateTime, formatMarks, formatPercent } from "@/lib/utils";

export const dynamic = "force-dynamic";

function accuracyOf(correct: number, wrong: number): number {
  const attempted = correct + wrong;
  return attempted > 0 ? (correct / attempted) * 100 : 0;
}

export default async function DashboardPage() {
  const user = await requireUser();
  const data = await getDashboard(user.id);

  const firstName = user.displayName.split(" ")[0] || user.displayName;
  const weakest = [...data.sections]
    .filter((section) => section.attempted > 0)
    .sort((a, b) => a.accuracy - b.accuracy)[0];
  const trendMax = Math.max(
    EXAM_PATTERN.passMark,
    ...data.trend.map((attempt) => Math.max(0, attempt.score)),
  );
  const lastSubmitted = data.trend[data.trend.length - 1] ?? null;
  const letter = lastSubmitted
    ? verdictFor(lastSubmitted.score, lastSubmitted.max)
    : null;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Your desk"
        title={`Welcome back, ${firstName}`}
        description="Supreme Court of India · Junior Court Assistant · 2026 pattern"
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/learn"
              className="rounded-md border border-line px-4 py-2 text-sm text-muted transition hover:border-accent/50 hover:text-ink"
            >
              Learn mode
            </Link>
            <Link
              href="/drill"
              className="rounded-md border border-line px-4 py-2 text-sm text-muted transition hover:border-accent/50 hover:text-ink"
            >
              Practice drill
            </Link>
            <StartMockButton />
          </div>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Papers submitted"
          value={data.submitted}
          hint={`${data.inProgress} in progress`}
        />
        <StatCard
          label="Best net"
          value={data.bestNet === null ? "—" : formatMarks(data.bestNet)}
          hint={`target ${EXAM_PATTERN.targetMark}`}
          tone={data.bestNet === null ? undefined : "text-accent"}
        />
        <StatCard
          label="Last net"
          value={data.lastNet === null ? "—" : formatMarks(data.lastNet)}
          hint={data.lastAt ? formatDateTime(data.lastAt) : "no papers yet"}
          tone={
            letter === null
              ? undefined
              : letter === "target"
                ? "text-ok"
                : letter === "pass"
                  ? "text-accent"
                  : "text-bad"
          }
        />
        <StatCard
          label="Average net"
          value={data.submitted > 0 ? formatMarks(data.averageNet) : "—"}
          hint={weakest ? `weakest: ${weakest.section}` : "accuracy per section below"}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.45fr_1fr]">
        <section className="rounded-xl border border-line bg-surface p-5">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted">
              Recent attempts
            </h2>
            {data.recent.length > 0 ? (
              <Link href="/history" className="text-xs text-muted hover:text-ink">
                All attempts →
              </Link>
            ) : null}
          </div>

          {data.recent.length === 0 ? (
            <div className="mt-4 rounded-lg border border-dashed border-line px-5 py-10 text-center">
              <p className="text-sm text-muted">
                No papers yet. A full mock takes 90 minutes; a drill takes five.
              </p>
              <Link
                href="/new"
                className="mt-4 inline-block rounded-md bg-accent px-4 py-2 text-sm font-semibold text-canvas transition hover:brightness-110"
              >
                Start the first mock
              </Link>
            </div>
          ) : (
            <>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-line text-[10px] uppercase tracking-widest text-muted">
                      <th className="pb-2 font-medium">When</th>
                      <th className="pb-2 font-medium">Paper</th>
                      <th className="pb-2 text-right font-medium">Net</th>
                      <th className="pb-2 text-right font-medium">Acc.</th>
                      <th className="pb-2 text-right font-medium">C</th>
                      <th className="pb-2 text-right font-medium" />
                    </tr>
                  </thead>
                  <tbody>
                    {data.recent.slice(0, 6).map((attempt) => (
                      <tr key={attempt.id} className="border-b border-line/60 last:border-0">
                        <td className="py-2.5 font-mono text-xs text-muted">
                          {formatDateTime(attempt.startedAt)}
                        </td>
                        <td className="max-w-[16rem] py-2.5">
                          <p className="truncate">{attempt.title}</p>
                          <p className="text-[10px] uppercase tracking-wider text-muted">
                            {attempt.status === "in_progress"
                              ? "in progress"
                              : attempt.kind === "learn"
                                ? `learn · ${attempt.max} questions`
                                : attempt.kind === "drill"
                                  ? `drill · ${attempt.max} questions`
                                  : "full mock"}
                          </p>
                        </td>
                        <td
                          className={cn(
                            "py-2.5 text-right font-mono",
                            attempt.status !== "submitted"
                              ? "text-muted"
                              : verdictFor(attempt.score, attempt.max) === "target"
                                ? "text-ok"
                                : verdictFor(attempt.score, attempt.max) === "pass"
                                  ? "text-accent"
                                  : "text-bad",
                          )}
                        >
                          {attempt.status === "submitted" ? formatMarks(attempt.score) : "—"}
                        </td>
                        <td className="py-2.5 text-right font-mono text-muted">
                          {attempt.status === "submitted"
                            ? formatPercent(accuracyOf(attempt.correct, attempt.wrong))
                            : "—"}
                        </td>
                        <td className="py-2.5 text-right font-mono text-muted">
                          {attempt.status === "submitted" ? attempt.correct : "—"}
                        </td>
                        <td className="py-2.5 text-right">
                          <Link
                            href={
                              attempt.status === "submitted"
                                ? `/result/${attempt.id}`
                                : `/attempt/${attempt.id}`
                            }
                            className="rounded border border-line px-2 py-1 text-xs text-muted transition hover:border-accent/50 hover:text-ink"
                          >
                            {attempt.status === "submitted" ? "Review" : "Resume"}
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {data.trend.length > 1 ? (
                <div className="mt-5 border-t border-line pt-4">
                  <div className="flex items-baseline justify-between text-[10px] uppercase tracking-widest text-muted">
                    <span>Trend</span>
                    <span className="font-mono normal-case tracking-normal">
                      last {data.trend.length}
                    </span>
                  </div>
                  <div className="mt-2 flex h-20 items-end gap-1.5">
                    {data.trend.map((attempt) => {
                      const height = Math.max(
                        4,
                        Math.round((Math.max(0, attempt.score) / trendMax) * 100),
                      );
                      const verdict = verdictFor(attempt.score, attempt.max);
                      return (
                        <div
                          key={attempt.id}
                          title={`${formatMarks(attempt.score)} net · ${formatDateTime(attempt.startedAt)}`}
                          className={cn(
                            "flex-1 rounded-t-sm",
                            verdict === "target"
                              ? "bg-ok/70"
                              : verdict === "pass"
                                ? "bg-accent/70"
                                : "bg-bad/60",
                          )}
                          style={{ height: `${height}%` }}
                        />
                      );
                    })}
                  </div>
                  <div className="mt-1 flex justify-between text-[10px] text-muted">
                    <span>older</span>
                    <span>
                      pass {EXAM_PATTERN.passMark} · target {EXAM_PATTERN.targetMark}
                    </span>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </section>

        <section className="rounded-xl border border-line bg-surface p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted">
              Section mastery
            </h2>
            <span className="font-mono text-xs text-muted">accuracy</span>
          </div>

          <ul className="mt-3 space-y-3">
            {data.sections.map((section) => (
              <li key={section.sectionId}>
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span>{section.section}</span>
                  <span className="font-mono text-xs text-muted">
                    {section.attempted === 0 ? (
                      "untouched"
                    ) : (
                      <>
                        {formatPercent(section.accuracy)}
                        <span className="ml-1.5">
                          {section.correct}/{section.attempted}
                        </span>
                      </>
                    )}
                  </span>
                </div>
                <div className="mt-1.5">
                  <ProgressBar value={section.accuracy} />
                </div>
              </li>
            ))}
          </ul>

          {weakest ? (
            <Link
              href={`/drill?section=${weakest.sectionId}`}
              className="mt-5 block rounded-md border border-line px-3 py-2 text-center text-sm text-muted transition hover:border-accent/50 hover:text-ink"
            >
              Drill {weakest.section} — {formatPercent(weakest.accuracy)}
            </Link>
          ) : null}
        </section>
      </div>

      <section className="rounded-xl border border-line bg-surface p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted">
            Paper pattern &amp; bank coverage
          </h2>
          <span className="text-xs text-muted">
            {data.totalQuestions} of {EXAM_PATTERN.sections.reduce((sum, s) => sum + s.count, 0)}{" "}
            questions in the bank ·{" "}
            <Link href="/bank" className="underline hover:text-ink">
              manage bank
            </Link>
          </span>
        </div>

        <div className="mt-4 grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
          {EXAM_PATTERN.sections.map((section) => {
            const have = data.bankCounts[section.id] ?? 0;
            const percent = Math.min(100, Math.round((have / section.count) * 100));
            return (
              <div key={section.id} className="flex items-center gap-3 text-sm">
                <span className="w-28 shrink-0 truncate">{sectionShort(section.id)}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
                  <div
                    className="h-full rounded-full bg-accent/80"
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <span className="w-14 shrink-0 text-right font-mono text-xs text-muted">
                  {have}/{section.count}
                </span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

