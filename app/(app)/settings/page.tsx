import Link from "next/link";
import { countDistinct, eq, sql } from "drizzle-orm";
import { SiteHeader } from "@/components/site-header";
import { requireUser } from "@/lib/auth/session";
import { db, dbUrl } from "@/lib/db";
import { attempts, questions, tests } from "@/lib/db/schema";
import { EXAM_PATTERN } from "@/lib/pattern";
import { ResetForm } from "./reset-form";
import { RestoreForm } from "./restore-form";

export const dynamic = "force-dynamic";

async function countQuestions(): Promise<number> {
  const row = await db.select({ n: sql<number>`count(*)` }).from(questions).get();
  return Number(row?.n ?? 0);
}

async function countOwned(userId: string): Promise<{ attempts: number; papers: number }> {
  const attemptRow = await db
    .select({ n: sql<number>`count(*)` })
    .from(attempts)
    .where(eq(attempts.userId, userId))
    .get();

  const paperRow = await db
    .select({ n: countDistinct(tests.id) })
    .from(attempts)
    .innerJoin(tests, eq(tests.id, attempts.testId))
    .where(eq(attempts.userId, userId))
    .get();

  return {
    attempts: Number(attemptRow?.n ?? 0),
    papers: Number(paperRow?.n ?? 0),
  };
}

export default async function SettingsPage() {
  const user = await requireUser();
  const isAdmin = user.role === "admin";

  const nQuestions = await countQuestions();
  const mine = await countOwned(user.id);

  return (
    <>
      <SiteHeader />
      <div className="mx-auto max-w-3xl px-6 py-8">
        <h1 className="text-xl font-semibold">Settings &amp; data</h1>
        <p className="mt-1 text-sm text-muted">
          Signed in as <span className="text-ink">{user.displayName || user.username}</span>.
          Your attempts, answers and mistake notebook are private to this account.
          {isAdmin
            ? " As an administrator you can also export and restore the whole database."
            : ""}
        </p>

        <section className="mt-6 rounded-xl border border-line bg-surface p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">
              What is in the database
            </h2>
            <span className="max-w-full truncate font-mono text-xs text-muted" title={dbUrl}>
              {dbUrl}
            </span>
          </div>

          <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
            {[
              { label: "Questions", value: nQuestions },
              { label: "My papers", value: mine.papers },
              { label: "My attempts", value: mine.attempts },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-lg border border-line bg-surface-2 px-3 py-3"
              >
                <dt className="text-[10px] uppercase tracking-widest text-muted">{stat.label}</dt>
                <dd className="mt-1 font-mono text-2xl leading-none">{stat.value}</dd>
              </div>
            ))}
          </dl>

          <p className="mt-4 text-xs leading-relaxed text-muted">
            The bank holds {nQuestions} question(s); the 2026 paper asks for{" "}
            {EXAM_PATTERN.totalQuestions}. Questions are shared by every account; attempt
            history is not. Import more from the{" "}
            <Link href="/bank" className="underline hover:text-ink">
              question bank
            </Link>{" "}
            page or with{" "}
            <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[11px]">
              npm run import -- content/
            </code>
            .
          </p>
        </section>

        {isAdmin ? (
          <>
            <section className="mt-6 rounded-xl border border-line bg-surface p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">
                  Export a database backup
                </h2>
                <span className="rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest text-accent">
                  Admin only
                </span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Downloads every account, question, paper, attempt and answer as one JSON file.
                Sessions are not included, so a restore never revives somebody&apos;s login.
                Keep it somewhere safe — this is the escape hatch if the hosted database is
                ever lost.
              </p>
              <a
                href="/api/backup"
                download
                className="mt-4 inline-block rounded-md bg-accent px-4 py-2 text-sm font-semibold text-canvas transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                Download backup
              </a>
            </section>

            <section className="mt-6 rounded-xl border border-line bg-surface p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">
                  Restore from a backup
                </h2>
                <span className="rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest text-accent">
                  Admin only
                </span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Load a file made by the export button. <strong className="text-ink">Merge</strong>{" "}
                keeps the current data and adds what is missing;{" "}
                <strong className="text-ink">Replace</strong> wipes questions, papers and
                attempts first. Accounts always survive a restore.
              </p>
              <RestoreForm />
            </section>
          </>
        ) : null}

        <section className="mt-6 rounded-xl border border-bad/30 bg-surface p-6">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-bad">
            Clear my practice history
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Deletes your attempts, papers and saved answers — including test runs that would
            otherwise drag down your dashboard trend and section mastery. The question bank and
            every other account are untouched, so you can start a clean first mock.
          </p>
          <ResetForm attempts={mine.attempts} papers={mine.papers} />
        </section>

        <section className="mt-6 rounded-xl border border-dashed border-line px-6 py-5">
          <h2 className="text-sm font-semibold">Accounts &amp; privacy</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-muted">
            <li>
              Accounts are created by the administrator. There is no public registration and no
              way to create a user from this page.
            </li>
            <li>
              Your scores, history, section mastery and mistake notebook are visible only to you
              and to the administrator, who has read-only access for monitoring.
            </li>
            <li>
              Signing out ends the session on this device. Sessions expire automatically after
              seven days.
            </li>
          </ul>
        </section>
      </div>
    </>
  );
}
