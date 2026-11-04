import Link from "next/link";
import { requireAdmin } from "@/lib/auth/session";
import { getAdminOverview } from "@/lib/admin";
import { cn, formatPercent, formatScore } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Monitoring · JCA Mock Exam",
};

function when(ms: number | null): string {
  if (ms === null) return "—";
  return new Date(ms).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-line bg-surface px-4 py-3">
      <div className="text-[10px] font-medium uppercase tracking-widest text-muted">{label}</div>
      <div className="mt-1 font-mono text-2xl leading-none">{value}</div>
      {hint ? <div className="mt-1 text-[11px] text-muted">{hint}</div> : null}
    </div>
  );
}

export default async function AdminOverviewPage() {
  const admin = await requireAdmin();
  const overview = await getAdminOverview();
  const candidates = overview.users.filter((user) => user.role === "user");

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Monitoring</h1>
          <p className="mt-1 text-sm text-muted">
            Read-only view of every account. Signed in as{" "}
            <span className="text-ink">{admin.displayName || admin.username}</span>.
          </p>
        </div>
        <span className="rounded-full border border-accent/40 bg-accent/10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-widest text-accent">
          Administrator
        </span>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Accounts" value={String(overview.totals.users)} hint={`${candidates.length} candidates`} />
        <Stat label="Scored attempts" value={String(overview.totals.scoredAttempts)} />
        <Stat label="In progress" value={String(overview.totals.inProgress)} />
        <Stat label="Active · 7 days" value={String(overview.totals.activeLast7Days)} />
      </div>

      <section className="mt-6 overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-[10px] uppercase tracking-widest text-muted">
              <th className="px-4 py-3 font-medium">Account</th>
              <th className="px-4 py-3 text-right font-medium">Attempts</th>
              <th className="px-4 py-3 text-right font-medium">Scored</th>
              <th className="px-4 py-3 text-right font-medium">Best</th>
              <th className="px-4 py-3 text-right font-medium">Average</th>
              <th className="px-4 py-3 text-right font-medium">Latest</th>
              <th className="px-4 py-3 text-right font-medium">Accuracy</th>
              <th className="px-4 py-3 font-medium">Weakest</th>
              <th className="px-4 py-3 font-medium">Last active</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {overview.users.map((user) => (
              <tr key={user.id} className="border-b border-line/60 last:border-0 hover:bg-surface-2/50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 font-medium">
                    {user.displayName || user.username}
                    {user.role === "admin" ? (
                      <span className="rounded border border-accent/40 bg-accent/10 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-widest text-accent">
                        Admin
                      </span>
                    ) : null}
                  </div>
                  <div className="font-mono text-[11px] text-muted">@{user.username}</div>
                </td>
                <td className="px-4 py-3 text-right font-mono">{user.attempts}</td>
                <td className="px-4 py-3 text-right font-mono">{user.scored}</td>
                <td className="px-4 py-3 text-right font-mono text-ok">
                  {user.bestNet === null ? "—" : formatScore(user.bestNet)}
                </td>
                <td className="px-4 py-3 text-right font-mono">
                  {user.averageNet === null ? "—" : formatScore(user.averageNet)}
                </td>
                <td className="px-4 py-3 text-right font-mono">
                  {user.latestNet === null ? "—" : formatScore(user.latestNet)}
                </td>
                <td className="px-4 py-3 text-right font-mono text-muted">
                  {user.scored === 0 ? "—" : formatPercent(user.accuracy)}
                </td>
                <td className="px-4 py-3 text-xs text-muted">
                  {user.weakestSection ?? "—"}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-muted">
                  {when(user.lastActive)}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/admin/users/${user.id}`}
                    className={cn(
                      "rounded border border-line px-2 py-1 text-xs text-muted transition",
                      "hover:border-accent/50 hover:text-ink",
                    )}
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <p className="mt-4 text-xs leading-relaxed text-muted">
        Monitoring is read-only. Administrators cannot submit answers, change a score, create an
        account or resume somebody else&apos;s paper.
      </p>
    </div>
  );
}
