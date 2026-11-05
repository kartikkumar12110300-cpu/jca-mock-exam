import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card, PageHeader, ProgressBar, StatCard } from "@/components/ui";
import { getUserPerformance } from "@/lib/admin/analytics";
import { requireAdmin } from "@/lib/auth/guards";
import { formatDate, formatDateTime, formatMarks, formatPercent } from "@/lib/utils";

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = {
  full: "Full mock",
  drill: "Drill",
  learn: "Learn set",
};

export default async function AdminUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const performance = await getUserPerformance(id);
  if (!performance) notFound();

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Admin · Candidate"
        title={performance.displayName}
        description={`@${performance.username} · joined ${formatDate(performance.createdAt)} · last login ${formatDateTime(performance.lastLoginAt)}`}
        action={
          <div className="flex gap-2">
            <Link
              href="/admin/users"
              className="rounded-md border border-line px-4 py-2 text-sm text-muted transition hover:border-accent/50 hover:text-ink"
            >
              All users
            </Link>
            <Link
              href="/admin"
              className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-canvas transition hover:brightness-110"
            >
              Overview
            </Link>
          </div>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Submitted"
          value={performance.submitted}
          hint={`${performance.inProgress} in progress`}
        />
        <StatCard
          label="Average net"
          value={performance.submitted > 0 ? formatMarks(performance.averageNet) : "—"}
          hint={`${formatPercent(performance.averagePercent)} average`}
          tone="text-accent"
        />
        <StatCard
          label="Best net"
          value={performance.bestNet === null ? "—" : formatMarks(performance.bestNet)}
          hint={`${performance.fullMocks} full mock${performance.fullMocks === 1 ? "" : "s"}`}
        />
        <StatCard
          label="Account"
          value={performance.active ? "Active" : "Inactive"}
          hint={performance.role === "admin" ? "Administrator" : "Candidate"}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <Card className="p-0">
          <div className="border-b border-line px-5 py-4">
            <h2 className="text-sm font-semibold">Section accuracy</h2>
            <p className="text-xs text-muted">Correct ÷ attempted for this candidate</p>
          </div>
          <ul className="divide-y divide-line">
            {performance.sections.map((section) => (
              <li key={section.sectionId} className="px-5 py-3.5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm">{section.section}</p>
                  <span className="font-mono text-xs">
                    {section.total === 0 ? "—" : formatPercent(section.accuracy)}
                  </span>
                </div>
                <div className="mt-2">
                  <ProgressBar value={section.accuracy} />
                </div>
                <p className="mt-1 text-[11px] text-muted">
                  {section.correct} correct · {section.wrong} wrong · {section.total} questions seen
                </p>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-0">
          <div className="border-b border-line px-5 py-4">
            <h2 className="text-sm font-semibold">Most missed</h2>
            <p className="text-xs text-muted">Questions this candidate keeps getting wrong</p>
          </div>
          {performance.mostMissed.length === 0 ? (
            <p className="px-5 py-8 text-sm text-muted">No wrong answers yet.</p>
          ) : (
            <ol className="divide-y divide-line">
              {performance.mostMissed.map((question) => (
                <li key={question.questionId} className="px-5 py-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <Badge tone="blue">{question.section}</Badge>
                    <span className="font-mono text-xs text-bad">{question.wrong} wrong</span>
                  </div>
                  <p className="mt-2 line-clamp-3 text-sm leading-5 text-muted">
                    {question.stem}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>

      <Card className="p-0">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-sm font-semibold">Attempt history</h2>
          <p className="text-xs text-muted">Latest twenty submitted papers</p>
        </div>

        {performance.attempts.length === 0 ? (
          <p className="px-5 py-8 text-sm text-muted">
            This candidate has not submitted a paper.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-2 text-[10px] uppercase tracking-widest text-muted">
                <tr>
                  <th className="px-5 py-3 font-medium">Paper</th>
                  <th className="px-5 py-3 font-medium">Kind</th>
                  <th className="px-5 py-3 text-right font-medium">Net</th>
                  <th className="px-5 py-3 text-right font-medium">Percent</th>
                  <th className="px-5 py-3 font-medium">Submitted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {performance.attempts.map((attempt) => (
                  <tr key={attempt.id} className="transition hover:bg-surface-2/60">
                    <td className="max-w-xs px-5 py-3">
                      <p className="truncate">{attempt.title}</p>
                    </td>
                    <td className="px-5 py-3">
                      <Badge tone={attempt.kind === "full" ? "blue" : "slate"}>
                        {KIND_LABEL[attempt.kind] ?? attempt.kind}
                      </Badge>
                    </td>
                    <td className="px-5 py-3 text-right font-mono">
                      {formatMarks(attempt.score)}
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-muted">
                      {formatPercent(attempt.percent)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 font-mono text-xs text-muted">
                      {formatDateTime(attempt.submittedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
