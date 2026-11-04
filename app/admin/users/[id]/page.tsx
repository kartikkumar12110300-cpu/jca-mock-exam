import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/session";
import { getAdminUserDetail } from "@/lib/admin";
import { scaledTargets } from "@/lib/pattern";
import { cn, formatPercent, formatScore } from "@/lib/utils";

export const dynamic = "force-dynamic";

function when(ms: number | null): string {
  if (ms === null) return "—";
  return new Date(ms).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function scoreTone(net: number, total: number): string {
  const { pass, target } = scaledTargets(total);
  if (net >= target) return "text-ok";
  if (net >= pass) return "text-accent";
  return "text-bad";
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg border border-line bg-surface px-4 py-3">
      <div className="text-[10px] font-medium uppercase tracking-widest text-muted">{label}</div>
      <div className={cn("mt-1 font-mono text-2xl leading-none", tone)}>{value}</div>
    </div>
  );
}

export default async function AdminUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const detail = await getAdminUserDetail(id);

  if (!detail) notFound();

  const name = detail.displayName || detail.username;

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <Link
        href="/admin"
        className="text-xs text-muted underline-offset-4 hover:text-ink hover:underline"
      >
        ← All accounts
      </Link>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            {name}
            {detail.role === "admin" ? (
              <span className="rounded border border-accent/40 bg-accent/10 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-widest text-accent">
                Admin
              </span>
            ) : null}
          </h1>
          <p className="mt-1 font-mono text-xs text-muted">
            @{detail.username} · joined {when(detail.createdAt)} ·{" "}
            {detail.isActive ? "active" : "disabled"}
          </p>
        </div>
        <p className="text-xs text-muted">Read-only monitoring · last active {when(detail.lastActive)}</p>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        <Stat label="Attempts" value={String(detail.attemptCount)} />
        <Stat label="Scored" value={String(detail.scoredCount)} />
        <Stat label="In progress" value={String(detail.inProgressCount)} />
        <Stat
          label="Best"
          value={detail.bestNet === null ? "—" : formatScore(detail.bestNet)}
          tone="text-ok"
        />
        <Stat
          label="Average"
          value={detail.averageNet === null ? "—" : formatScore(detail.averageNet)}
        />
        <Stat
          label="Accuracy"
          value={detail.scoredCount === 0 ? "—" : formatPercent(detail.accuracy)}
        />
        <Stat label="Mistakes" value={String(detail.mistakes)} tone="text-bad" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-xl border border-line bg-surface p-5">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">
            Section mastery
          </h2>
          {detail.mastery.length === 0 ? (
            <p className="mt-3 text-sm text-muted">No scored attempts yet.</p>
          ) : (
            <table className="mt-3 w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-widest text-muted">
                  <th className="pb-2 font-medium">Section</th>
                  <th className="pb-2 text-right font-medium">Seen</th>
                  <th className="pb-2 text-right font-medium">Accuracy</th>
                  <th className="pb-2 text-right font-medium">Avg net</th>
                </tr>
              </thead>
              <tbody>
                {detail.mastery.map((row) => (
                  <tr key={row.sectionId} className="border-t border-line/60">
                    <td className="py-2">{row.short}</td>
                    <td className="py-2 text-right font-mono text-muted">{row.seen}</td>
                    <td
                      className={cn(
                        "py-2 text-right font-mono",
                        row.accuracy >= 0.7
                          ? "text-ok"
                          : row.accuracy >= 0.5
                            ? "text-accent"
                            : "text-bad",
                      )}
                    >
                      {row.correct + row.wrong === 0 ? "—" : formatPercent(row.accuracy)}
                    </td>
                    <td className="py-2 text-right font-mono">{formatScore(row.avgNet)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="rounded-xl border border-line bg-surface p-5">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">
            By activity
          </h2>
          {detail.byKind.length === 0 ? (
            <p className="mt-3 text-sm text-muted">Nothing scored yet.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {detail.byKind.map((row) => (
                <li key={row.kind} className="flex items-center justify-between border-b border-line/60 pb-2 last:border-0">
                  <span className="capitalize text-muted">{row.kind}</span>
                  <span className="font-mono">
                    {row.attempts} · avg {formatScore(row.averageNet)}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <h3 className="mt-5 text-[10px] font-medium uppercase tracking-widest text-muted">
            Recent trend
          </h3>
          {detail.trend.length === 0 ? (
            <p className="mt-2 text-sm text-muted">No completed papers.</p>
          ) : (
            <div className="mt-2 flex flex-wrap gap-1">
              {detail.trend.map((point) => (
                <span
                  key={point.id}
                  className={cn(
                    "rounded border border-line bg-surface-2 px-2 py-1 font-mono text-[11px]",
                    scoreTone(point.net, point.total),
                  )}
                  title={new Date(point.at).toLocaleString("en-IN")}
                >
                  {formatScore(point.net)}/{point.total}
                </span>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="mt-6 overflow-x-auto rounded-xl border border-line bg-surface">
        <div className="flex items-center justify-between px-4 py-3">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">
            Attempts
          </h2>
          <span className="text-xs text-muted">{detail.attempts.length} row(s)</span>
        </div>
        {detail.attempts.length === 0 ? (
          <p className="border-t border-line px-4 py-8 text-center text-sm text-muted">
            This account has not started a paper yet.
          </p>
        ) : (
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-y border-line text-left text-[10px] uppercase tracking-widest text-muted">
                <th className="px-4 py-2.5 font-medium">Started</th>
                <th className="px-4 py-2.5 font-medium">Paper</th>
                <th className="px-4 py-2.5 text-right font-medium">Net</th>
                <th className="px-4 py-2.5 text-right font-medium">Accuracy</th>
                <th className="px-4 py-2.5 text-right font-medium">Status</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {detail.attempts.map((attempt) => {
                const finished = attempt.status !== "in_progress";
                return (
                  <tr key={attempt.id} className="border-b border-line/60 last:border-0">
                    <td className="whitespace-nowrap px-4 py-2.5 text-xs text-muted">
                      {when(attempt.startedAt)}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="font-medium">{attempt.title}</div>
                      <div className="text-[10px] uppercase tracking-wider text-muted">
                        {attempt.kind} · {attempt.total} questions
                      </div>
                    </td>
                    <td
                      className={cn(
                        "px-4 py-2.5 text-right font-mono",
                        finished ? scoreTone(attempt.net, attempt.total) : "text-muted",
                      )}
                    >
                      {finished ? formatScore(attempt.net) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-muted">
                      {finished ? formatPercent(attempt.accuracy) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs text-muted">
                      {attempt.status === "in_progress"
                        ? "in progress"
                        : attempt.status === "expired"
                          ? "time up"
                          : "submitted"}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {finished && attempt.kind !== "learn" ? (
                        <Link
                          href={`/attempt/${attempt.id}/result`}
                          className="rounded border border-line px-2 py-1 text-xs text-muted transition hover:border-accent/50 hover:text-ink"
                        >
                          Review
                        </Link>
                      ) : (
                        <span className="text-xs text-muted">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
