import Link from "next/link";
import { RichText } from "@/components/rich-text";
import { SiteHeader } from "@/components/site-header";
import { bankCounts, listBank } from "@/lib/drill";
import { EXAM_PATTERN, getSection } from "@/lib/pattern";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const KEY_TONE: Record<string, string> = {
  official: "text-ok border-ok/40 bg-ok/10",
  unofficial: "text-accent border-accent/40 bg-accent/10",
  disputed: "text-bad border-bad/40 bg-bad/10",
};

export default async function BankPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string }>;
}) {
  const { section } = await searchParams;
  const rows = listBank(section);
  const counts = bankCounts();
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  const selected = section ? getSection(section) : undefined;

  return (
    <>
      <SiteHeader />
      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Question bank</h1>
            <p className="mt-1 text-sm text-muted">
              {total} published questions. Content is imported from JSON files in{" "}
              <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[11px]">
                content/
              </code>{" "}
              — see the README.
            </p>
          </div>
          {selected ? (
            <Link
              href="/bank"
              className="rounded-md border border-line px-3 py-1.5 text-sm text-muted transition hover:text-ink"
            >
              Clear filter
            </Link>
          ) : null}
        </div>

        <div className="mt-5 flex flex-wrap gap-2 text-xs">
          <Link
            href="/bank"
            className={cn(
              "rounded-full border px-2.5 py-1 transition",
              section
                ? "border-line text-muted hover:text-ink"
                : "border-accent/50 bg-accent/10 text-accent",
            )}
          >
            All {total}
          </Link>
          {EXAM_PATTERN.sections.map((s) => {
            const have = counts.get(s.id) ?? 0;
            return (
              <Link
                key={s.id}
                href={`/bank?section=${s.id}`}
                className={cn(
                  "rounded-full border px-2.5 py-1 transition",
                  section === s.id
                    ? "border-accent/50 bg-accent/10 text-accent"
                    : "border-line text-muted hover:text-ink",
                )}
              >
                {s.short} {have}/{s.count}
              </Link>
            );
          })}
        </div>

        {rows.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-line px-6 py-16 text-center">
            <p className="text-sm text-muted">
              No questions in this section yet. Import some with{" "}
              <code className="font-mono text-xs">npm run import -- content/&lt;file&gt;.json</code>
              .
            </p>
          </div>
        ) : (
          <div className="mt-5 space-y-2.5">
            {rows.map((q) => (
              <article key={q.id} className="rounded-lg border border-line bg-surface px-4 py-3">
                <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-wider text-muted">
                  <span className="rounded border border-line px-1.5 py-0.5">{q.sectionShort}</span>
                  <span>{q.topic || "general"}</span>
                  <span>· {q.difficulty}</span>
                  <span
                    className={cn(
                      "rounded border px-1.5 py-0.5",
                      KEY_TONE[q.keyStatus] ?? "border-line",
                    )}
                  >
                    {q.keyStatus} key
                  </span>
                  <span className="rounded border border-line px-1.5 py-0.5">{q.sourceType}</span>
                  {q.isBonus ? (
                    <span className="rounded border border-accent/40 bg-accent/10 px-1.5 py-0.5 text-accent">
                      bonus
                    </span>
                  ) : null}
                  <span className="ml-auto font-mono normal-case tracking-normal">
                    seen {q.seen} · {q.correct}✓ {q.wrong}✗
                  </span>
                </div>

                <RichText text={q.stem} className="mt-2 block text-sm leading-relaxed" />

                {q.sourceRef ? (
                  <div className="mt-1.5 text-[10px] uppercase tracking-wider text-muted/70">
                    {q.sourceRef}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
