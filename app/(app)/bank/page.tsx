import Link from "next/link";
import { Badge, Card, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth/guards";
import { SECTIONS, sectionName } from "@/lib/exam/pattern";
import { listBank } from "@/lib/exam/queries";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 12;

const FIELD =
  "mt-1 w-full rounded-md border border-line bg-surface-2 px-3 py-2 text-sm text-ink focus-visible:border-accent/60";

function pageHref(params: {
  section?: string;
  topic?: string;
  q?: string;
  page: number;
}): string {
  const search = new URLSearchParams();
  if (params.section) search.set("section", params.section);
  if (params.topic) search.set("topic", params.topic);
  if (params.q) search.set("q", params.q);
  if (params.page > 1) search.set("page", String(params.page));
  const query = search.toString();
  return query ? `/bank?${query}` : "/bank";
}

export default async function BankPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string; topic?: string; q?: string; page?: string }>;
}) {
  await requireUser();
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const result = await listBank({
    section: params.section,
    topic: params.topic,
    search: params.q,
    page,
    pageSize: PAGE_SIZE,
  });

  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const start = result.total === 0 ? 0 : (result.page - 1) * result.pageSize + 1;
  const end = Math.min(result.total, result.page * result.pageSize);

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Question bank"
        title="Browse every question"
        description="Read the full bank with answers and explanations. Use it to study, not to memorise."
      />

      <Card>
        <form method="get" className="grid gap-3 sm:grid-cols-[1fr_1fr_1.4fr_auto]">
          <label className="block">
            <span className="text-[11px] font-medium uppercase tracking-widest text-muted">
              Section
            </span>
            <select name="section" defaultValue={params.section ?? ""} className={FIELD}>
              <option value="">All sections</option>
              {SECTIONS.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-[11px] font-medium uppercase tracking-widest text-muted">
              Topic
            </span>
            <select name="topic" defaultValue={params.topic ?? ""} className={FIELD}>
              <option value="">All topics</option>
              {result.topics.map((topic) => (
                <option key={topic} value={topic}>
                  {topic}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-[11px] font-medium uppercase tracking-widest text-muted">
              Search
            </span>
            <input
              name="q"
              defaultValue={params.q ?? ""}
              placeholder="Search question, topic, tag"
              className={FIELD}
            />
          </label>

          <div className="flex items-end gap-2">
            <button
              type="submit"
              className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-canvas transition hover:brightness-110"
            >
              Filter
            </button>
            <Link
              href="/bank"
              className="rounded-md border border-line px-4 py-2 text-sm text-muted transition hover:border-accent/50 hover:text-ink"
            >
              Clear
            </Link>
          </div>
        </form>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          Showing{" "}
          <span className="font-mono text-ink">
            {start}–{end}
          </span>{" "}
          of <span className="font-mono text-ink">{result.total}</span> questions
        </p>
        <div className="flex items-center gap-2 text-sm">
          {result.page > 1 ? (
            <Link
              href={pageHref({ ...params, page: result.page - 1 })}
              className="rounded-md border border-line px-3 py-1.5 text-muted transition hover:border-accent/50 hover:text-ink"
            >
              Previous
            </Link>
          ) : null}
          <span className="font-mono text-xs text-muted">
            Page {result.page} / {totalPages}
          </span>
          {result.page < totalPages ? (
            <Link
              href={pageHref({ ...params, page: result.page + 1 })}
              className="rounded-md border border-line px-3 py-1.5 text-muted transition hover:border-accent/50 hover:text-ink"
            >
              Next
            </Link>
          ) : null}
        </div>
      </div>

      {result.items.length === 0 ? (
        <Card className="border-dashed py-12 text-center">
          <p className="text-sm text-muted">No questions match these filters.</p>
          <Link href="/bank" className="mt-2 inline-block text-sm font-medium text-accent">
            Clear filters
          </Link>
        </Card>
      ) : (
        <ol className="space-y-4">
          {result.items.map((question, index) => (
            <li key={question._id}>
              <Card>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="blue">{sectionName(question.sectionId)}</Badge>
                  {question.topic ? <Badge>{question.topic}</Badge> : null}
                  <Badge
                    tone={
                      question.difficulty === "hard"
                        ? "red"
                        : question.difficulty === "easy"
                          ? "green"
                          : "amber"
                    }
                  >
                    {question.difficulty}
                  </Badge>
                  {question.isBonus ? <Badge tone="green">Bonus</Badge> : null}
                  <span className="ml-auto font-mono text-xs text-muted">
                    {start + index}
                  </span>
                </div>

                <p className="mt-3 whitespace-pre-line text-sm leading-6">{question.stem}</p>

                <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
                  {question.options.map((option, optionIndex) => {
                    const correct = question.correctIndex === optionIndex;
                    return (
                      <li
                        key={optionIndex}
                        className={
                          correct
                            ? "rounded-md border border-ok/50 bg-ok/10 px-3 py-2 text-sm"
                            : "rounded-md border border-line px-3 py-2 text-sm text-muted"
                        }
                      >
                        <span className="mr-2 font-mono text-xs text-muted">
                          {String.fromCharCode(65 + optionIndex)}
                        </span>
                        {option}
                        {correct ? (
                          <span className="ml-2 text-xs font-medium text-ok">correct</span>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>

                {question.explanation ? (
                  <details className="mt-3 rounded-lg border border-line bg-surface-2 px-3 py-2">
                    <summary className="cursor-pointer text-xs font-medium text-muted">
                      Explanation
                    </summary>
                    <p className="mt-2 text-sm leading-6 text-muted">{question.explanation}</p>
                  </details>
                ) : null}
              </Card>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
