import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { requireUser } from "@/lib/auth/session";
import { availableSections, createDrill, getMistakes, type DrillMode } from "@/lib/drill";
import { getSection } from "@/lib/pattern";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

async function startDrill(formData: FormData) {
  "use server";

  const user = await requireUser();
  const sectionId = String(formData.get("sectionId") ?? "") || undefined;
  const count = Number(formData.get("count") ?? 10);
  const mode = (String(formData.get("mode") ?? "weak") as DrillMode) ?? "weak";

  const attemptId = await createDrill(user.id, { sectionId, count, mode });
  redirect(`/attempt/${attemptId}`);
}

const MODES: Array<{ id: DrillMode; label: string; hint: string }> = [
  {
    id: "weak",
    label: "Weak areas first",
    hint: "Questions you have got wrong before come first, then ones you have not seen.",
  },
  {
    id: "unseen",
    label: "Never seen",
    hint: "Questions with the fewest previous attempts — good for breadth.",
  },
  {
    id: "mixed",
    label: "Random mix",
    hint: "A random draw. Use it when you just want reps.",
  },
];

export default async function DrillPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string; count?: string }>;
}) {
  const params = await searchParams;
  const user = await requireUser();
  const sections = await availableSections();
  const selected = params.section && sections.some((s) => s.id === params.section)
    ? params.section
    : "";
  const mistakes = await getMistakes(user.id);
  const defaultCount = Math.max(5, Math.min(20, Number(params.count ?? 10) || 10));

  const sectionName = selected ? (getSection(selected)?.short ?? selected) : "All sections";

  return (
    <>
      <SiteHeader />
      <div className="mx-auto max-w-3xl px-6 py-8">
        <h1 className="text-xl font-semibold">Practice drill</h1>
        <p className="mt-1 text-sm text-muted">
          Short papers built from the bank. Same engine as the full mock: autosave, negative
          marking, instant scoring. 90 seconds per question, so 10 questions is 15 minutes.
        </p>

        <form
          action={startDrill}
          className="mt-6 rounded-xl border border-line bg-surface p-6"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-[11px] font-medium uppercase tracking-widest text-muted">
                Section
              </span>
              <select
                name="sectionId"
                defaultValue={selected}
                className="mt-1.5 w-full rounded-md border border-line bg-surface-2 px-3 py-2 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <option value="">All sections</option>
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.short} ({s.count})
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-[11px] font-medium uppercase tracking-widest text-muted">
                Questions
              </span>
              <select
                name="count"
                defaultValue={String(defaultCount)}
                className="mt-1.5 w-full rounded-md border border-line bg-surface-2 px-3 py-2 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                {[5, 10, 15, 20, 30].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <fieldset className="mt-5">
            <legend className="text-[11px] font-medium uppercase tracking-widest text-muted">
              Question order
            </legend>
            <div className="mt-2 space-y-2">
              {MODES.map((mode, i) => (
                <label
                  key={mode.id}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border border-line bg-surface-2 px-3.5 py-2.5 transition has-checked:border-accent/60 has-checked:bg-accent/5"
                >
                  <input
                    type="radio"
                    name="mode"
                    value={mode.id}
                    defaultChecked={i === 0}
                    className="mt-0.5 accent-[var(--color-accent)]"
                  />
                  <span>
                    <span className="block text-sm font-medium">{mode.label}</span>
                    <span className="block text-xs leading-relaxed text-muted">{mode.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-line pt-5">
            <button
              type="submit"
              className="rounded-md bg-accent px-5 py-2.5 text-sm font-semibold text-canvas transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Start drill — {sectionName}
            </button>
            <Link href="/new" className="text-sm text-muted hover:text-ink">
              or take a full mock →
            </Link>
          </div>
        </form>

        <section className="mt-6 rounded-xl border border-line bg-surface p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">
              Mistake notebook
            </h2>
            <Link href="/mistakes" className="text-xs text-muted hover:text-ink">
              All {mistakes.length} →
            </Link>
          </div>

          {mistakes.length === 0 ? (
            <p className="mt-3 text-sm leading-relaxed text-muted">
              Questions you answer wrongly show up here, with the explanation. Nothing yet —
              finish a paper first.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {mistakes.slice(0, 4).map((m) => (
                <li key={m.questionId} className="rounded-lg border border-line bg-surface-2 px-3.5 py-2.5">
                  <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted">
                    <span>{m.sectionShort}</span>
                    <span className={cn(m.wrongCount > 1 && "text-bad")}>
                      missed {m.wrongCount}×
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm">{m.stem}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
