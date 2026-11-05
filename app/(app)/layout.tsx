import Link from "next/link";
import { AppNav } from "@/components/app-nav";
import { requireUser } from "@/lib/auth/guards";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await requireUser();

  return (
    <div className="flex min-h-dvh flex-col">
      <AppNav
        displayName={user.displayName}
        username={user.username}
        role={user.role}
      />
      {user.mustChangePassword ? (
        <div className="border-b border-accent/30 bg-accent/10">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-2 sm:px-6">
            <p className="text-xs text-accent">
              You are still using a shared seed password. Set your own before
              you rely on this account.
            </p>
            <Link
              href="/settings"
              className="rounded border border-accent/50 px-2.5 py-1 text-xs font-medium text-accent transition hover:bg-accent/10"
            >
              Set a password
            </Link>
          </div>
        </div>
      ) : null}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        {children}
      </main>
      <footer className="border-t border-line px-4 py-6 text-center text-[11px] text-muted">
        JCA Mock Exam · {new Date().getFullYear()} · Private practice space
      </footer>
    </div>
  );
}
