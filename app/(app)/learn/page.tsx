import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge, Card, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth/guards";
import { createAttempt } from "@/lib/exam/service";
import {
  EXAM_PATTERN,
  LEARN_COUNTS,
  LEARN_MAX_QUESTIONS,
  LEARN_PAGE_SIZE,
  SECTIONS,
  SECTION_IDS,
  sectionName,
  type SectionId,
} from "@/lib/exam/pattern";
import { getSectionCounts } from "@/lib/exam/queries";

export const dynamic = "force-dynamic";

const NOTES: Record<string, { focus: string; notes: string[]; traps: string }> = {
  english: {
    focus: "Comprehension speed, grammar rules, and vocabulary in context.",
    notes: [
      "Read the passage once for structure, then answer; do not hunt line by line.",
      "Revise subject–verb agreement, articles, prepositions, and tense consistency.",
      "For idioms and one-word substitutions, eliminate literal meanings first.",
    ],
    traps: "Extreme options ('always', 'never') are usually wrong in comprehension.",
  },
  aptitude: {
    focus: "Arithmetic, reasoning, and data interpretation under time pressure.",
    notes: [
      "Master percentages, ratios, averages, profit–loss, and time–work.",
      "Learn tables to 20 and squares to 30 to cut calculation time.",
      "Skip a calculation that will take more than 90 seconds; return later.",
    ],
    traps: "Unit mismatches (minutes vs hours, rupees vs paise) are common.",
  },
  gk: {
    focus: "Current affairs, polity, history, geography, and general science.",
    notes: [
      "Follow Supreme Court appointments, judgments, and constitutional changes.",
      "Revise static GK in small, repeated passes rather than one long read.",
      "Use the bank filters to revise one topic at a time.",
    ],
    traps: "Questions often test the latest position, not the general rule.",
  },
  constitution: {
    focus: "The text and structure of the Constitution, especially the judiciary.",
    notes: [
      "Know Articles 124–147 thoroughly: appointment, tenure, jurisdiction.",
      "Revise fundamental rights, writs, and the basic structure doctrine.",
      "Build a one-page map of article numbers; they are easy to confuse.",
    ],
    traps: "Article numbers are easy to confuse; build a one-page map.",
  },
  "sc-rules-2013": {
    focus: "Supreme Court Rules, 2013 — procedure, filing, and court practice.",
    notes: [
      "Learn the order structure: institution, scrutiny, listing, hearing.",
      "Revise provisions on affidavits, applications, and defect removal.",
      "Read the rule, not a summary, for numbers and time limits.",
    ],
    traps: "Days vs working days, and the specific form prescribed, decide the answer.",
  },
  "sci-rules-1961": {
    focus: "Supreme Court Rules, 1961 and the practices they preserve.",
    notes: [
      "Compare the 1961 and 2013 rules where the 2013 rules carry forward old practice.",
      "Revise terminology that still appears in court filings.",
      "Focus on provisions the 2013 rules expressly save or repeal.",
    ],
    traps: "A rule repeated in substance may still differ in a number or form.",
  },
  computer: {
    focus: "Fundamentals, office tools, internet, and security.",
    notes: [
      "Revise hardware, memory units, operating-system basics, and file types.",
      "Practise spreadsheet formulas and word-processing shortcuts.",
      "Revise cyber hygiene: passwords, phishing, malware, and backups.",
    ],
    traps: "Shortcut keys and protocol names are the most commonly swapped facts.",
  },
};

export default async function LearnPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string }>;
}) {
  await requireUser();
  const counts = await getSectionCounts();
  const params = await searchParams;
  const selected = SECTION_IDS.includes(params.section as SectionId)
    ? (params.section as string)
    : "";

  async function startLearn(formData: FormData) {
    "use server";

    const current = await requireUser();
    const rawSection = String(formData.get("sectionId") ?? "");
    const sectionId = SECTION_IDS.includes(rawSection as SectionId)
      ? rawSection
      : undefined;
    const rawCount = Number(formData.get("count"));
    const count = (LEARN_COUNTS as readonly number[]).includes(rawCount)
      ? rawCount
      : LEARN_PAGE_SIZE * 2;

    const created = await createAttempt(current.id, { kind: "learn", sectionId, count });
    redirect(`/learn/${created.attemptId}`);
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Learn mode"
        title="Work through questions, one page at a time"
        description="No clock. Pick an option, see immediately whether you were right, and read the explanation before moving on."
        action={
          <Link
            href="/drill"
            className="rounded-md border border-line px-4 py-2 text-sm text-muted transition hover:border-accent/50 hover:text-ink"
          >
            Timed drill →
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
        <Card>
          <form action={startLearn} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-[11px] font-medium uppercase tracking-widest text-muted">
                  Section
                </span>
                <select
                  name="sectionId"
                  defaultValue={selected}
                  className="mt-1.5 w-full rounded-md border border-line bg-surface-2 px-3 py-2 text-sm"
                >
                  <option value="">All sections</option>
                  {SECTIONS.map((section) => (
                    <option key={section.id} value={section.id}>
                      {section.name} ({counts[section.id] ?? 0})
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
                  className="mt-1.5 w-full rounded-md border border-line bg-surface-2 px-3 py-2 text-sm"
                >
                  {LEARN_COUNTS.map((count) => (
                    <option key={count} value={count}>
                      {count} · {Math.ceil(count / LEARN_PAGE_SIZE)} pages
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <ul className="rounded-lg border border-line bg-surface-2 px-4 py-3 text-xs leading-relaxed text-muted">
              <li>· Pick an option — it is marked right or wrong straight away.</li>
              <li>· The correct answer and explanation are revealed.</li>
              <li>· An answer locks once you choose it, so it is a rep, not a guess.</li>
              <li>· Answers save as you go; close the tab and resume within 30 days.</li>
              <li>· Learn sessions feed section mastery and the mistake notebook.</li>
            </ul>

            <button
              type="submit"
              className="rounded-md bg-accent px-5 py-2.5 text-sm font-semibold text-canvas transition hover:brightness-110"
            >
              Start learning
            </button>
          </form>
        </Card>

        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
          <Card className="border-accent/30 bg-surface-2">
            <p className="text-[11px] uppercase tracking-widest text-accent">Pass</p>
            <p className="mt-1 font-mono text-3xl">{EXAM_PATTERN.passMark}</p>
            <p className="mt-1 text-xs text-muted">marks out of 100</p>
          </Card>
          <Card>
            <p className="text-[11px] uppercase tracking-widest text-muted">Target</p>
            <p className="mt-1 font-mono text-3xl">{EXAM_PATTERN.targetMark}</p>
            <p className="mt-1 text-xs text-muted">a competitive score</p>
          </Card>
          <Card>
            <p className="text-[11px] uppercase tracking-widest text-muted">Per wrong</p>
            <p className="mt-1 font-mono text-3xl text-bad">−0.25</p>
            <p className="mt-1 text-xs text-muted">guess only with an edge</p>
          </Card>
        </div>
      </div>

      <section>
        <div className="mb-4">
          <h2 className="text-lg font-semibold tracking-tight">A short map of the syllabus</h2>
          <p className="text-sm text-muted">
            Not a textbook — directions for what to revise and how the paper tests it.
            Sessions can hold up to {LEARN_MAX_QUESTIONS} questions.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {SECTIONS.map((section) => {
            const note = NOTES[section.id];
            return (
              <Card key={section.id}>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-base font-semibold">{sectionName(section.id)}</h3>
                  <Badge tone="blue">{counts[section.id] ?? 0} in bank</Badge>
                </div>
                {note ? (
                  <>
                    <p className="mt-2 text-sm leading-6 text-muted">{note.focus}</p>
                    <ul className="mt-3 space-y-1.5 text-sm leading-5 text-muted">
                      {note.notes.map((line) => (
                        <li key={line} className="flex gap-2">
                          <span
                            aria-hidden
                            className="mt-2 size-1 shrink-0 rounded-full bg-accent"
                          />
                          <span>{line}</span>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-3 border-l-2 border-accent/40 pl-3 text-xs leading-5 text-muted">
                      Watch out: {note.traps}
                    </p>
                  </>
                ) : null}
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}
