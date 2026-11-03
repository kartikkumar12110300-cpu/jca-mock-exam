import Link from "next/link";
import { eq, sql } from "drizzle-orm";
import { SiteHeader } from "@/components/site-header";
import { db } from "@/lib/db";
import { questions } from "@/lib/db/schema";
import { EXAM_PATTERN, scaledTargets } from "@/lib/pattern";
import { listAttempts, sectionMastery } from "@/lib/stats";
import { cn, formatPercent, formatScore } from "@/lib/utils";

export const dynamic = "force-dynamic";

function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: string;
}) {
  return (
    <div className="rounded-lg border border-line bg-surface px-4 py-3">
      <div className="text-[11px] font-medium uppercase tracking-widest text-muted">{label}</div>
      <div className={cn("mt-1 font-mono text-2xl leading-none", tone)}>{value}</div>
      {hint ? <div className="mt-1 text-xs text-muted">{hint}</div> : null}
    </div>
  );
}

/**
 * Tone a net score by the pass/target marks appropriate to that paper's size.
 * Pass `total` (the number of questions the attempt actually sat) so short
 * mocks and drills are not judged against the full 100-question thresholds.
 */
function scoreTone(net: number, total?: number): string {
  const { pass, target } = scaledTargets(total ?? EXAM_PATTERN.totalQuestions);
  if (net >= target) return "text-ok";
  if (net >= pass) return "text-accent";
  return "text-bad";
}

function when(ms: number): string {
  return new Date(ms).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Home() {
  const counts = db
    .select({ sectionId: questions.sectionId, n: sql<number>`count(*)` })
    .from(questions)
    .where(eq(questions.status, "published"))
    .groupBy(questions.sectionId)
    .all();

  const bySection = new Map(counts.map((c) => [c.sectionId, c.n]));
  const total = counts.reduce((sum, c) => sum + c.n, 0);

  const history = listAttempts(20, { excludeKinds: ["learn"] });
  const submitted = history.filter((a) => a.status !== "in_progress");
  const mastery = sectionMastery();

  const best = submitted.reduce((m, a) => Math.max(m, a.net), -Infinity);
  const last = submitted[0];
  const average =
    submitted.length === 0
      ? 0
      : submitted.reduce((sum, a) => sum + a.net, 0) / submitted.length;
  const weakest = mastery.find((m) => m.correct + m.wrong > 0) ?? null;

  // Oldest-to-newest for the trend strip.
  const trend = [...submitted].reverse().slice(-14);
  const trendMax = Math.max(EXAM_PATTERN.totalQuestions, ...trend.map((a) => a.total));

  return (
    <>
      <SiteHeader />

      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">Dashboard</h1>
            <p className="mt-1 text-sm text-muted">
              Supreme Court of India · Junior Court Assistant · 2026
            </p>
          </div>
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
            <Link
              href="/new"
              className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-canvas transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Start a full mock
            </Link>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat
            label="Attempts"
            value={String(submitted.length)}
            hint={submitted.length === 1 ? "one paper done" : "papers completed"}
          />
          <Stat
            label="Best net"
            value={submitted.length ? formatScore(best) : "—"}
            hint={`target ${EXAM_PATTERN.targetMark}`}
            tone={submitted.length ? scoreTone(best) : undefined}
          />
          <Stat
            label="Last net"
            value={last ? formatScore(last.net) : "—"}
            hint={last ? when(last.submittedAt ?? last.startedAt) : "no attempts yet"}
            tone={last ? scoreTone(last.net) : undefined}
          />
          <Stat
            label="Average"
            value={submitted.length ? formatScore(Math.round(average * 100) / 100) : "—"}
            hint={weakest ? `weakest: ${weakest.short}` : "accuracy per section below"}
          />
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.45fr_1fr]">
          <section className="rounded-xl border border-line bg-surface p-5">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">
                Recent attempts
              </h2>
              {history.length > 0 ? (
                <Link href="/history" className="text-xs text-muted hover:text-ink">
                  All attempts →
                </Link>
              ) : null}
            </div>

            {history.length === 0 ? (
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
                <table className="mt-3 w-full text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-[11px] uppercase tracking-widest text-muted">
                      <th className="pb-2 font-medium">When</th>
                      <th className="pb-2 font-medium">Paper</th>
                      <th className="pb-2 text-right font-medium">Net</th>
                      <th className="pb-2 text-right font-medium">Acc.</th>
                      <th className="pb-2 text-right font-medium">Correct</th>
                      <th className="pb-2 text-right font-medium" />
                    </tr>
                  </thead>
                  <tbody>
                    {history.slice(0, 8).map((a) => (
                      <tr key={a.id} className="border-b border-line/60 last:border-0">
                        <td className="py-2.5 text-xs text-muted">{when(a.startedAt)}</td>
                        <td className="py-2.5">
                          <span className="line-clamp-1">{a.title}</span>
                          <span className="text-[10px] uppercase tracking-wider text-muted">
                            {a.status === "in_progress"
                              ? "in progress"
                              : a.status === "expired"
                                ? "time up"
                                : `${a.total} questions`}
                          </span>
                        </td>
                        <td
                          className={cn(
                            "py-2.5 text-right font-mono",
                            a.status === "in_progress" ? "text-muted" : scoreTone(a.net, a.total),
                          )}
                        >
                          {a.status === "in_progress" ? "—" : formatScore(a.net)}
                        </td>
                        <td className="py-2.5 text-right font-mono text-muted">
                          {a.status === "in_progress" ? "—" : formatPercent(a.accuracy)}
                        </td>
                        <td className="py-2.5 text-right font-mono text-muted">{a.correct}</td>
                        <td className="py-2.5 text-right">
                          <Link
                            href={
                              a.status === "in_progress"
                                ? `/attempt/${a.id}`
                                : `/attempt/${a.id}/result`
                            }
                            className="rounded border border-line px-2 py-1 text-xs text-muted transition hover:border-accent/50 hover:text-ink"
                          >
                            {a.status === "in_progress" ? "Resume" : "Review"}
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {trend.length > 1 ? (
                  <div className="mt-5 border-t border-line pt-4">
                    <div className="flex items-baseline justify-between text-[11px] uppercase tracking-widest text-muted">
                      <span>Trend</span>
                      <span className="font-mono normal-case tracking-normal">
                        last {trend.length}
                      </span>
                    </div>
                    <div className="mt-2 flex h-20 items-end gap-1.5">
                      {trend.map((a) => {
                        const height = Math.max(4, Math.round((Math.max(0, a.net) / trendMax) * 100));
                        const { target, pass } = scaledTargets(a.total);
                        return (
                          <div
                            key={a.id}
                            title={`${formatScore(a.net)} net · ${when(a.startedAt)}`}
                            className={cn(
                              "flex-1 rounded-t-sm",
                              a.net >= target
                                ? "bg-ok/70"
                                : a.net >= pass
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
                      <span>pass {EXAM_PATTERN.passMark} · target {EXAM_PATTERN.targetMark}</span>
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </section>

          <section className="rounded-xl border border-line bg-surface p-5">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">
                Section mastery
              </h2>
              <span className="font-mono text-xs text-muted">accuracy</span>
            </div>

            {mastery.length === 0 ? (
              <p className="mt-4 text-sm leading-relaxed text-muted">
                Finish a paper and this fills in — accuracy per section, weakest first. Use it
                to pick the next drill.
              </p>
            ) : (
              <ul className="mt-3 space-y-3">
                {mastery.map((row) => {
                  const attempted = row.correct + row.wrong;
                  return (
                    <li key={row.sectionId} className={cn(attempted === 0 && "opacity-50")}>
                      <div className="flex items-baseline justify-between text-sm">
                        <span>{row.short}</span>
                        <span className="font-mono text-xs text-muted">
                          {attempted === 0 ? (
                            "untouched"
                          ) : (
                            <>
                              {formatPercent(row.accuracy)}
                              <span className="ml-1.5">
                                {row.correct}/{attempted}
                              </span>
                            </>
                          )}
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            row.accuracy >= 0.75
                              ? "bg-ok/80"
                              : row.accuracy >= 0.5
                                ? "bg-accent/80"
                                : "bg-bad/70",
                          )}
                          style={{ width: `${Math.round(row.accuracy * 100)}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {weakest ? (
              <Link
                href={`/drill?section=${weakest.sectionId}`}
                className="mt-5 block rounded-md border border-line px-3 py-2 text-center text-sm text-muted transition hover:border-accent/50 hover:text-ink"
              >
                Drill {weakest.short} — {formatPercent(weakest.accuracy)}
              </Link>
            ) : null}
          </section>
        </div>

        <section className="mt-6 rounded-xl border border-line bg-surface p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">
              Paper pattern &amp; bank coverage
            </h2>
            <span className="text-xs text-muted">
              {total} of {EXAM_PATTERN.totalQuestions} questions in the bank ·{" "}
              <Link href="/bank" className="underline hover:text-ink">
                manage bank
              </Link>
            </span>
          </div>

          <div className="mt-4 grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
            {EXAM_PATTERN.sections.map((section) => {
              const have = bySection.get(section.id) ?? 0;
              const pct = Math.min(100, Math.round((have / section.count) * 100));
              return (
                <div key={section.id} className="flex items-center gap-3 text-sm">
                  <span className="w-28 shrink-0 truncate">{section.short}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
                    <div
                      className="h-full rounded-full bg-accent/80"
                      style={{ width: `${pct}%` }}
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
    </>
  );
}
