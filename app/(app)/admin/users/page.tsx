import Link from "next/link";
import { Badge, Card, EmptyState, PageHeader, ProgressBar } from "@/components/ui";
import { listUserSummaries } from "@/lib/admin/analytics";
import { requireAdmin } from "@/lib/auth/guards";
import { formatDate, formatDateTime, formatMarks, formatPercent } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  await requireAdmin();
  const summaries = await listUserSummaries();
  const candidates = summaries.filter((user) => user.role === "user");
  const admins = summaries.filter((user) => user.role === "admin");

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Admin · Users"
        title="Candidate performance"
        description="One row per account. Open a candidate to see their attempts, section accuracy, and most-missed questions."
        action={
          <Link
            href="/admin"
            className="rounded-md border border-line px-4 py-2 text-sm text-muted transition hover:border-accent/50 hover:text-ink"
          >
            Back to overview
          </Link>
        }
      />

      {candidates.length === 0 ? (
        <EmptyState
          title="No candidates found"
          description="Seed the database to create the practice accounts."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {candidates.map((user) => (
            <Link key={user.id} href={`/admin/users/${user.id}`} className="group">
              <Card className="h-full transition group-hover:border-accent/40">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold">{user.displayName}</p>
                    <p className="font-mono text-sm text-muted">@{user.username}</p>
                  </div>
                  <Badge tone={user.active ? "green" : "red"}>
                    {user.active ? "Active" : "Inactive"}
                  </Badge>
                </div>

                <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg border border-line bg-surface-2 px-2 py-2">
                    <dt className="text-[10px] uppercase tracking-widest text-muted">Papers</dt>
                    <dd className="mt-1 font-mono text-sm">{user.attempts}</dd>
                  </div>
                  <div className="rounded-lg border border-line bg-surface-2 px-2 py-2">
                    <dt className="text-[10px] uppercase tracking-widest text-muted">Avg net</dt>
                    <dd className="mt-1 font-mono text-sm">
                      {user.attempts > 0 ? formatMarks(user.avgNet) : "—"}
                    </dd>
                  </div>
                  <div className="rounded-lg border border-line bg-surface-2 px-2 py-2">
                    <dt className="text-[10px] uppercase tracking-widest text-muted">Best</dt>
                    <dd className="mt-1 font-mono text-sm">
                      {user.attempts > 0 ? formatMarks(user.bestNet) : "—"}
                    </dd>
                  </div>
                </dl>

                <div className="mt-4">
                  <ProgressBar value={user.avgPercent} />
                </div>
                <p className="mt-1 text-right font-mono text-[10px] text-muted">
                  {formatPercent(user.avgPercent)} average
                </p>

                <p className="mt-3 text-xs text-muted">
                  Last paper {formatDateTime(user.lastSubmittedAt)}
                </p>
                <p className="mt-1 text-xs text-muted">Joined {formatDate(user.createdAt)}</p>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {admins.length > 0 ? (
        <Card>
          <h2 className="text-sm font-semibold">Administrators</h2>
          <ul className="mt-3 divide-y divide-line">
            {admins.map((user) => (
              <li key={user.id} className="flex items-center justify-between py-2.5 text-sm">
                <span>
                  <span className="font-medium">{user.displayName}</span>
                  <span className="ml-2 font-mono text-xs text-muted">@{user.username}</span>
                </span>
                <Badge tone="green">Admin</Badge>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
