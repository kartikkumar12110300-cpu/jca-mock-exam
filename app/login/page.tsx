import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { EXAM_PATTERN } from "@/lib/pattern";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Sign in · JCA Mock Exam",
};

function daysUntil(dateIso: string): number {
  const target = new Date(`${dateIso}T00:00:00+05:30`).getTime();
  return Math.ceil((target - Date.now()) / 86_400_000);
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect(user.role === "admin" ? "/admin" : "/");

  const { next } = await searchParams;
  const safeNext =
    next && next.startsWith("/") && !next.startsWith("//") ? next : undefined;

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <span className="mx-auto grid size-11 place-items-center rounded-md border border-accent/40 bg-accent/10 font-mono text-xs font-semibold text-accent">
            JCA
          </span>
          <h1 className="mt-3 text-xl font-semibold">JCA Mock Exam</h1>
          <p className="mt-1 text-xs text-muted">
            Supreme Court of India · Junior Court Assistant · {daysUntil(EXAM_PATTERN.examDate)}{" "}
            days to paper
          </p>
        </div>

        <div className="rounded-xl border border-line bg-surface p-6">
          <h2 className="text-sm font-semibold">Sign in</h2>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            Accounts are created by the administrator. There is no public registration.
          </p>

          <div className="mt-5">
            <LoginForm next={safeNext} />
          </div>
        </div>

        <p className="mt-4 text-center text-[11px] leading-relaxed text-muted">
          Your exam history is private to your account.{" "}
          <Link href="/" className="underline hover:text-ink">
            Return home
          </Link>
        </p>
      </div>
    </main>
  );
}
