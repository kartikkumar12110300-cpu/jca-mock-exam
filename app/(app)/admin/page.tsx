import Link from "next/link";
import { Badge, Card, PageHeader, ProgressBar, StatCard } from "@/components/ui";
import { getAdminOverview } from "@/lib/admin/analytics";
import { requireAdmin } from "@/lib/auth/guards";
import { formatDateTime, formatMarks, formatPercent } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireAdmin();
  const overview = await getAdminOverview();

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Admin console"
        title="Performance across all candidates"
        description="Aggregate results, section accuracy, and the questions most often missed. Passwords are never exposed."
        action={
          <Link
            href="/admin/users"
            className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-canvas transition hover:brightness-110"
          >
            All users
          </Link>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Candidates"
          value={overview.users}
          hint={`${overview.activeUsers} active accounts`}
        />
        <StatCard
          label="Submitted papers"
          value={overview.submittedAttempts}
          hint={`${overview.inProgressAttempts} in progress`}
        />
        <StatCard
          label="Average net"
          value={overview.fullMocks > 0 ? formatMarks(overview.averageNet) : "—"}
          hint={`${overview.fullMocks} full mock${overview.fullMocks === 1 ? "" : "s"} · ${formatPercent(overview.averagePercent)}`}
          tone="text-accent"
        />
        <StatCard
          label="Pass rate"
          value={overview.fullMocks > 0 ? formatPercent(overview.passRate) : "—"}
          hint="Full mocks only · pass 50"
          tone={
            overview.fullMocks === 0
              ? undefined
              : overview.passRate >= 50
                ? "text-ok"
                : "text-bad"
          }
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <Card className="p-0">
          <div className="border-b border-line px-5 py-4">
            <h2 className="text-sm font-semibold">Section accuracy</h2>
            <p className="text-xs text-muted">All candidates, all submitted papers</p>
          </div>
          <ul className="divide-y divide-line">
            {overview.sections.map((section) => (
              <li key={section.sectionId} className="px-5 py-3.5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm">{section.section}</p>
                  <div className="text-right">
                    <span className="font-mono text-xs text-ink">
                      {section.total === 0 ? "—" : formatPercent(section.accuracy)}
                    </span>
                    <p className="text-[11px] text-muted">
                      {section.correct} correct · {section.wrong} wrong
                    </p>
                  </div>
                </div>
                <div className="mt-2">
                  <ProgressBar value={section.accuracy} />
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-0">
          <div className="border-b border-line px-5 py-4">
            <h2 className="text-sm font-semibold">Most missed questions</h2>
            <p className="text-xs text-muted">Wrong answers across every candidate</p>
          </div>
          {overview.mostMissed.length === 0 ? (
            <p className="px-5 py-8 text-sm text-muted">No wrong answers recorded yet.</p>
          ) : (
            <ol className="divide-y divide-line">
              {overview.mostMissed.map((question) => (
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
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold">Recent submissions</h2>
            <p className="text-xs text-muted">The last ten submitted papers</p>
          </div>
          <Link href="/admin/users" className="text-xs text-muted transition hover:text-ink">
            Open user list →
          </Link>
        </div>

        {overview.recentAttempts.length === 0 ? (
          <p className="px-5 py-8 text-sm text-muted">No candidate has submitted a paper yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-2 text-[10px] uppercase tracking-widest text-muted">
                <tr>
                  <th className="px-5 py-3 font-medium">Candidate</th>
                  <th className="px-5 py-3 font-medium">Paper</th>
                  <th className="px-5 py-3 text-right font-medium">Net</th>
                  <th className="px-5 py-3 text-right font-medium">Percent</th>
                  <th className="px-5 py-3 font-medium">Submitted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {overview.recentAttempts.map((attempt) => (
                  <tr key={attempt.id} className="transition hover:bg-surface-2/60">
                    <td className="px-5 py-3">
                      <Link
                        href={`/admin/users/${attempt.userId}`}
                        className="font-medium transition hover:text-accent"
                      >
                        {attempt.displayName}
                      </Link>
                      <p className="font-mono text-xs text-muted">@{attempt.username}</p>
                    </td>
                    <td className="max-w-xs px-5 py-3">
                      <p className="truncate text-muted">{attempt.title}</p>
                    </td>
                    <td className="px-5 py-3 text-right font-mono">{formatMarks(attempt.score)}</td>
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
