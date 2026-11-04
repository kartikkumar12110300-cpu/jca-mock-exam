import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { requireUser } from "@/lib/auth/session";
import { scaledTargets } from "@/lib/pattern";
import { listAttempts } from "@/lib/stats";
import { cn, formatPercent, formatScore } from "@/lib/utils";

export const dynamic = "force-dynamic";

function scoreTone(net: number, total: number): string {
  const { pass, target } = scaledTargets(total);
  if (net >= target) return "text-ok";
  if (net >= pass) return "text-accent";
  return "text-bad";
}

export default async function HistoryPage() {
  const user = await requireUser();
  const rows = await listAttempts(user.id, 200);

  return (
    <>
      <SiteHeader />
      <div className="mx-auto max-w-5xl px-6 py-8">
        <h1 className="text-xl font-semibold">Attempt history</h1>
        <p className="mt-1 text-sm text-muted">
          Every paper you have started, newest first. In-progress papers can be resumed.
        </p>

        {rows.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-line px-6 py-16 text-center">
            <p className="text-sm text-muted">Nothing yet.</p>
            <Link
              href="/new"
              className="mt-4 inline-block rounded-md bg-accent px-4 py-2 text-sm font-semibold text-canvas transition hover:brightness-110"
            >
              Start a full mock
            </Link>
          </div>
        ) : (
          <div className="mt-6 overflow-x-auto rounded-xl border border-line bg-surface">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-[11px] uppercase tracking-widest text-muted">
                  <th className="px-4 py-3 font-medium">Started</th>
                  <th className="px-4 py-3 font-medium">Paper</th>
                  <th className="px-4 py-3 text-right font-medium">Net</th>
                  <th className="px-4 py-3 text-right font-medium">Correct</th>
                  <th className="px-4 py-3 text-right font-medium">Wrong</th>
                  <th className="px-4 py-3 text-right font-medium">Skipped</th>
                  <th className="px-4 py-3 text-right font-medium">Accuracy</th>
                  <th className="px-4 py-3 text-right font-medium">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => {
                  const href =
                    a.status === "in_progress"
                      ? a.kind === "learn"
                        ? `/learn/${a.id}`
                        : `/attempt/${a.id}`
                      : `/attempt/${a.id}/result`;

                  return (
                  <tr key={a.id} className="border-b border-line/60 last:border-0">
                    <td className="whitespace-nowrap px-4 py-2.5 text-xs text-muted">
                      {new Date(a.startedAt).toLocaleString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="font-medium">{a.title}</div>
                      <div className="text-[10px] uppercase tracking-wider text-muted">
                        {a.kind} · {a.total} questions
                      </div>
                    </td>
                    <td
                      className={cn(
                        "px-4 py-2.5 text-right font-mono",
                        a.status === "in_progress" ? "text-muted" : scoreTone(a.net, a.total),
                      )}
                    >
                      {a.status === "in_progress" ? "—" : formatScore(a.net)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-ok">{a.correct}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-bad">{a.wrong}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-muted">{a.skipped}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-muted">
                      {a.status === "in_progress" ? "—" : formatPercent(a.accuracy)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs text-muted">
                      {a.status === "in_progress"
                        ? "in progress"
                        : a.status === "expired"
                          ? "time up"
                          : "submitted"}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Link
                        href={href}
                        className="rounded border border-line px-2 py-1 text-xs text-muted transition hover:border-accent/50 hover:text-ink"
                      >
                        {a.status === "in_progress"
                          ? a.kind === "learn"
                            ? "Resume learn"
                            : "Resume"
                          : "Review"}
                      </Link>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
