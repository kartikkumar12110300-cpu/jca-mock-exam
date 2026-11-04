import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { requireUser } from "@/lib/auth/session";
import { availableSections } from "@/lib/drill";
import { createLearnSession, LEARN_PAGE_SIZE } from "@/lib/learn";
import { getSection } from "@/lib/pattern";

export const dynamic = "force-dynamic";

async function startLearn(formData: FormData) {
  "use server";

  const user = await requireUser();
  const sectionId = String(formData.get("sectionId") ?? "") || undefined;
  const count = Number(formData.get("count") ?? LEARN_PAGE_SIZE * 2);

  const attemptId = await createLearnSession(user.id, { sectionId, count });
  redirect(`/learn/${attemptId}`);
}

export default async function LearnPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string }>;
}) {
  const params = await searchParams;
  await requireUser();
  const sections = await availableSections();
  const selected =
    params.section && sections.some((s) => s.id === params.section) ? params.section : "";
  const sectionName = selected ? (getSection(selected)?.short ?? selected) : "All sections";

  return (
    <>
      <SiteHeader />
      <div className="mx-auto max-w-3xl px-6 py-8">
        <h1 className="text-xl font-semibold">Learn mode</h1>
        <p className="mt-1 text-sm text-muted">
          Answer a question and find out immediately whether you were right, with the
          explanation. Questions are shown {LEARN_PAGE_SIZE} to a page, and an answer locks once
          you choose it.
        </p>

        <form action={startLearn} className="mt-6 rounded-xl border border-line bg-surface p-6">
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
                defaultValue={String(LEARN_PAGE_SIZE * 2)}
                className="mt-1.5 w-full rounded-md border border-line bg-surface-2 px-3 py-2 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                {[10, 20, 30, 40].map((n) => (
                  <option key={n} value={n}>
                    {n} · {Math.ceil(n / LEARN_PAGE_SIZE)} page{n > LEARN_PAGE_SIZE ? "s" : ""}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-5 rounded-lg border border-line bg-surface-2 px-3.5 py-3 text-xs leading-relaxed text-muted">
            <p className="font-medium text-ink">How it works</p>
            <ul className="mt-1.5 list-disc space-y-1 pl-4">
              <li>Pick an option — it is marked right or wrong straight away.</li>
              <li>The correct answer and explanation are revealed.</li>
              <li>Answers save as you go, so you can close the tab and resume later.</li>
              <li>Sessions count towards section mastery and the mistake notebook.</li>
            </ul>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-line pt-5">
            <button
              type="submit"
              className="rounded-md bg-accent px-5 py-2.5 text-sm font-semibold text-canvas transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Start learning — {sectionName}
            </button>
            <Link href="/drill" className="text-sm text-muted hover:text-ink">
              or take a timed drill →
            </Link>
          </div>
        </form>

        <p className="mt-4 text-xs leading-relaxed text-muted">
          Unlike a mock, learn mode has no clock and no negative marking pressure. Use it to
          work through new questions; use a mock when you want an honest score.
        </p>
      </div>
    </>
  );
}
