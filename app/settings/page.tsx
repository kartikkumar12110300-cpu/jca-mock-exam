import Link from "next/link";
import { sql } from "drizzle-orm";
import { SiteHeader } from "@/components/site-header";
import { db } from "@/lib/db";
import { attempts, questions, tests } from "@/lib/db/schema";
import { EXAM_PATTERN } from "@/lib/pattern";
import { ResetForm } from "./reset-form";
import { RestoreForm } from "./restore-form";

export const dynamic = "force-dynamic";

function count(table: typeof questions | typeof tests | typeof attempts): number {
  const row = db.select({ n: sql<number>`count(*)` }).from(table).get();
  return row?.n ?? 0;
}

export default function SettingsPage() {
  const nQuestions = count(questions);
  const nTests = count(tests);
  const nAttempts = count(attempts);

  return (
    <>
      <SiteHeader />
      <div className="mx-auto max-w-3xl px-6 py-8">
        <h1 className="text-xl font-semibold">Settings &amp; data</h1>
        <p className="mt-1 text-sm text-muted">
          This app is fully local. There is no account and no cloud — everything lives in a
          single SQLite file on this machine.
        </p>

        <section className="mt-6 rounded-xl border border-line bg-surface p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">
              What is in the database
            </h2>
            <span className="font-mono text-xs text-muted">data/app.db</span>
          </div>

          <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
            {[
              { label: "Questions", value: nQuestions },
              { label: "Papers", value: nTests },
              { label: "Attempts", value: nAttempts },
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
            {EXAM_PATTERN.totalQuestions}. Import more from the{" "}
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

        <section className="mt-6 rounded-xl border border-line bg-surface p-6">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">
            Export a backup
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Downloads every question, paper, attempt and answer as one JSON file. Keep it
            somewhere safe, or move it to another machine and restore it there.
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
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">
            Restore from a backup
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Load a file made by the export button. <strong className="text-ink">Merge</strong>{" "}
            keeps this machine&apos;s data and adds what is missing;{" "}
            <strong className="text-ink">Replace</strong> wipes it first.
          </p>
          <RestoreForm />
        </section>

        <section className="mt-6 rounded-xl border border-bad/30 bg-surface p-6">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-bad">
            Clear practice history
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Deletes every attempt, paper and saved answer — including test runs that would
            otherwise drag down your dashboard trend and section mastery. The question bank
            and its provenance are kept, so you can start a clean first mock.
          </p>
          <ResetForm attempts={nAttempts} papers={nTests} />
        </section>

        <section className="mt-6 rounded-xl border border-dashed border-line px-6 py-5">
          <h2 className="text-sm font-semibold">Moving to another computer</h2>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm leading-relaxed text-muted">
            <li>Export a backup here.</li>
            <li>Copy the app folder (or the portable zip) to the other machine.</li>
            <li>Start it, open Settings, and restore the backup.</li>
          </ol>
          <p className="mt-3 text-xs text-muted">
            Nothing leaves your computer unless you move the file yourself.
          </p>
        </section>
      </div>
    </>
  );
}
