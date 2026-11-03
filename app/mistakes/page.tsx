import Link from "next/link";
import { RichText } from "@/components/rich-text";
import { SiteHeader } from "@/components/site-header";
import { getMistakes } from "@/lib/drill";
import { EXAM_PATTERN } from "@/lib/pattern";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function MistakesPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string }>;
}) {
  const { section } = await searchParams;
  const all = getMistakes();
  const rows = section ? all.filter((m) => m.sectionId === section) : all;

  const counts = new Map<string, number>();
  for (const m of all) counts.set(m.sectionId, (counts.get(m.sectionId) ?? 0) + 1);

  return (
    <>
      <SiteHeader />
      <div className="mx-auto max-w-4xl px-6 py-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Mistake notebook</h1>
            <p className="mt-1 text-sm text-muted">
              Every question you have answered wrongly, newest first. Read the explanation,
              then drill the section.
            </p>
          </div>
          {section ? (
            <Link
              href="/mistakes"
              className="rounded-md border border-line px-3 py-1.5 text-sm text-muted transition hover:text-ink"
            >
              Clear filter
            </Link>
          ) : null}
        </div>

        <div className="mt-5 flex flex-wrap gap-2 text-xs">
          <Link
            href="/mistakes"
            className={cn(
              "rounded-full border px-2.5 py-1 transition",
              section
                ? "border-line text-muted hover:text-ink"
                : "border-accent/50 bg-accent/10 text-accent",
            )}
          >
            All {all.length}
          </Link>
          {EXAM_PATTERN.sections
            .filter((s) => (counts.get(s.id) ?? 0) > 0)
            .map((s) => (
              <Link
                key={s.id}
                href={`/mistakes?section=${s.id}`}
                className={cn(
                  "rounded-full border px-2.5 py-1 transition",
                  section === s.id
                    ? "border-accent/50 bg-accent/10 text-accent"
                    : "border-line text-muted hover:text-ink",
                )}
              >
                {s.short} {counts.get(s.id)}
              </Link>
            ))}
        </div>

        {rows.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-line px-6 py-16 text-center">
            <p className="text-sm text-muted">
              {all.length === 0
                ? "No mistakes recorded yet. Finish a paper and the ones you got wrong land here."
                : "No mistakes in this section. Try another filter."}
            </p>
            <Link
              href="/new"
              className="mt-4 inline-block rounded-md bg-accent px-4 py-2 text-sm font-semibold text-canvas transition hover:brightness-110"
            >
              Take a mock
            </Link>
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            {rows.map((m) => (
              <article key={m.questionId} className="rounded-xl border border-line bg-surface p-5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] uppercase tracking-wider text-muted">
                  <span>{m.sectionShort}</span>
                  <span className={cn(m.wrongCount > 1 && "text-bad")}>
                    missed {m.wrongCount}× · last{" "}
                    {new Date(m.lastWrongAt).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                    })}
                  </span>
                </div>

                <RichText text={m.stem} className="mt-2 block text-sm leading-relaxed" />

                <ul className="mt-3 space-y-1.5 text-sm">
                  {m.options.map((option, i) => {
                    const isCorrect = i === m.correctIndex;
                    const isChosen = i === m.chosenIndex;
                    return (
                      <li
                        key={i}
                        className={cn(
                          "flex items-start gap-2 rounded-md border px-3 py-2",
                          isCorrect
                            ? "border-ok/50 bg-ok/10"
                            : isChosen
                              ? "border-bad/50 bg-bad/10"
                              : "border-line/60",
                        )}
                      >
                        <span className="font-mono text-xs text-muted">
                          {String.fromCharCode(65 + i)}
                        </span>
                        <span className="flex-1">{option}</span>
                        {isChosen ? (
                          <span className="text-[10px] uppercase text-muted">your answer</span>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>

                {m.explanation ? (
                  <p className="mt-3 border-l-2 border-accent/40 pl-3 text-xs leading-relaxed text-muted">
                    {m.explanation}
                  </p>
                ) : null}

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[10px] uppercase tracking-wider text-muted/70">
                    {m.sourceRef ?? "bank"}
                  </span>
                  <div className="flex gap-2">
                    <Link
                      href={`/drill?section=${m.sectionId}&count=10`}
                      className="rounded border border-line px-2.5 py-1 text-xs text-muted transition hover:border-accent/50 hover:text-ink"
                    >
                      Drill {m.sectionShort}
                    </Link>
                    <Link
                      href={`/attempt/${m.attemptId}/result?filter=wrong`}
                      className="rounded border border-line px-2.5 py-1 text-xs text-muted transition hover:border-accent/50 hover:text-ink"
                    >
                      Open paper
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
