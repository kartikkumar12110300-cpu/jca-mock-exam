import Link from "next/link";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth/guards";
import { verdictFor } from "@/lib/exam/pattern";
import { listAttempts } from "@/lib/exam/queries";
import { cn, formatDateTime, formatMarks, formatPercent } from "@/lib/utils";

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = {
  full: "Full mock",
  drill: "Drill",
  learn: "Learn set",
};

export default async function HistoryPage() {
  const user = await requireUser();
  const attempts = await listAttempts(user.id);

  const submitted = attempts.filter((attempt) => attempt.status === "submitted");

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="History"
        title="Every paper you have written"
        description={`${submitted.length} submitted attempt${submitted.length === 1 ? "" : "s"} on this account.`}
        action={
          <Link
            href="/new"
            className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-canvas transition hover:brightness-110"
          >
            New mock
          </Link>
        }
      />

      {attempts.length === 0 ? (
        <EmptyState
          title="Your history is empty"
          description="Start your first paper. Results, section accuracy, and explanations will be stored here."
          action={
            <Link
              href="/new"
              className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-canvas transition hover:brightness-110"
            >
              Start a full mock
            </Link>
          }
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-2 text-[10px] uppercase tracking-widest text-muted">
                <tr>
                  <th className="px-5 py-3 font-medium">Paper</th>
                  <th className="px-5 py-3 font-medium">Started</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 text-right font-medium">Correct</th>
                  <th className="px-5 py-3 text-right font-medium">Wrong</th>
                  <th className="px-5 py-3 text-right font-medium">Score</th>
                  <th className="px-5 py-3 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {attempts.map((attempt) => {
                  const verdict =
                    attempt.status === "submitted"
                      ? verdictFor(attempt.score, attempt.max)
                      : null;
                  return (
                    <tr key={attempt.id} className="transition hover:bg-surface-2/60">
                      <td className="max-w-xs px-5 py-3">
                        <p className="truncate font-medium">{attempt.title}</p>
                        <p className="text-[10px] uppercase tracking-wider text-muted">
                          {KIND_LABEL[attempt.kind] ?? attempt.kind} · {attempt.max} questions
                        </p>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 font-mono text-xs text-muted">
                        {formatDateTime(attempt.startedAt)}
                      </td>
                      <td className="px-5 py-3">
                        {attempt.status === "submitted" ? (
                          <Badge tone="green">Submitted</Badge>
                        ) : (
                          <Badge tone="amber">In progress</Badge>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-ok">
                        {attempt.status === "submitted" ? attempt.correct : "—"}
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-bad">
                        {attempt.status === "submitted" ? attempt.wrong : "—"}
                      </td>
                      <td
                        className={cn(
                          "px-5 py-3 text-right font-mono",
                          verdict === "target"
                            ? "text-ok"
                            : verdict === "pass"
                              ? "text-accent"
                              : verdict === "below"
                                ? "text-bad"
                                : "text-muted",
                        )}
                      >
                        {attempt.status === "submitted"
                          ? `${formatMarks(attempt.score)} / ${attempt.max} · ${formatPercent(attempt.percent)}`
                          : "—"}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Link
                          href={
                            attempt.status === "submitted"
                              ? `/result/${attempt.id}`
                              : attempt.kind === "learn"
                                ? `/learn/${attempt.id}`
                                : `/attempt/${attempt.id}`
                          }
                          className="rounded border border-line px-2.5 py-1 text-xs text-muted transition hover:border-accent/50 hover:text-ink"
                        >
                          {attempt.status === "submitted" ? "Review" : "Resume"}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
