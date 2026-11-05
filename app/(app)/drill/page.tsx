import { DrillForm } from "@/components/drill-form";
import { Card, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth/guards";
import { SECTION_IDS } from "@/lib/exam/pattern";
import { getSectionCounts } from "@/lib/exam/queries";

export const dynamic = "force-dynamic";

export default async function DrillPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string }>;
}) {
  await requireUser();
  const counts = await getSectionCounts();
  const params = await searchParams;
  const defaultSection = SECTION_IDS.includes(params.section as never)
    ? (params.section as string)
    : "";

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Focused practice"
        title="Start a drill"
        description="Short sets with the same marking as the real paper. Pick a section, a length, and how questions should be chosen."
      />

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <Card>
          <DrillForm sectionCounts={counts} defaultSection={defaultSection} />
        </Card>

        <div className="space-y-4">
          <Card>
            <h2 className="text-sm font-semibold">Drill rules</h2>
            <ul className="mt-3 space-y-2 text-sm leading-5 text-muted">
              <li>· 90 seconds per question on the clock.</li>
              <li>· +1 correct, −0.25 wrong, 0 skipped.</li>
              <li>· Answers autosave as you go.</li>
              <li>· Full explanations appear after submission.</li>
              <li>· Short drills are judged against scaled pass and target marks.</li>
            </ul>
          </Card>
          <Card className="border-accent/30 bg-surface-2">
            <h2 className="text-sm font-semibold text-accent">A note on drills</h2>
            <p className="mt-2 text-sm leading-5 text-muted">
              Drills repair specific weaknesses. Use &ldquo;Unseen and weak&rdquo; after
              reviewing your mistake notebook, and &ldquo;Never seen&rdquo; when you want
              clean coverage.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
