import { SettingsClient } from "@/components/settings-client";
import { Badge, Card, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth/guards";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireUser();

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Account"
        title="Settings"
        description="Your account, your password, and a portable copy of your data."
      />

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold">{user.displayName}</h2>
            <p className="font-mono text-sm text-muted">@{user.username}</p>
          </div>
          <div className="flex items-center gap-3">
            <Badge tone={user.role === "admin" ? "green" : "slate"}>
              {user.role === "admin" ? "Administrator" : "Candidate"}
            </Badge>
            <span className="text-xs text-muted">Joined {formatDate(user.createdAt)}</span>
          </div>
        </div>
        <p className="mt-4 text-sm leading-6 text-muted">
          Accounts are created by the administrator. There is no public
          registration, and administrators cannot reset another person&apos;s
          password — only you can change your own.
        </p>
        {user.mustChangePassword ? (
          <p className="mt-4 rounded-md border border-accent/40 bg-accent/10 px-3 py-2 text-sm text-accent">
            This account still uses a shared seed password. Change it below to
            finish setting up your account.
          </p>
        ) : null}
      </Card>

      <SettingsClient />
    </div>
  );
}
