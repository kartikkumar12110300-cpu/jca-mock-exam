import { StartMockButton } from "@/components/start-mock-button";
import { Card, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth/guards";
import { EXAM_PATTERN, SECTION_IDS, sectionName } from "@/lib/exam/pattern";
import { getSectionCounts } from "@/lib/exam/queries";

export const dynamic = "force-dynamic";

export default async function NewMockPage() {
  await requireUser();
  const counts = await getSectionCounts();

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="New paper"
        title="Build a full mock"
        description="Every paper is assembled fresh. Nothing is reused in the same order twice."
        action={<StartMockButton />}
      />

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <h2 className="text-base font-semibold">Exam pattern</h2>
          <p className="mt-1 text-sm text-muted">
            {EXAM_PATTERN.durationSec / 60} minutes for 100 questions. The paper
            auto-submits when the clock reaches zero.
          </p>

          <div className="mt-5 overflow-hidden rounded-lg border border-line">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-2 text-[11px] uppercase tracking-widest text-muted">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Section</th>
                  <th className="px-4 py-2.5 text-right font-medium">Questions</th>
                  <th className="px-4 py-2.5 text-right font-medium">In bank</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {EXAM_PATTERN.sections.map((section) => (
                  <tr key={section.id}>
                    <td className="px-4 py-2.5">{sectionName(section.id)}</td>
                    <td className="px-4 py-2.5 text-right font-mono">{section.count}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-muted">
                      {counts[section.id] ?? 0}
                    </td>
                  </tr>
                ))}
                <tr className="bg-surface-2/70 font-medium">
                  <td className="px-4 py-2.5">Total</td>
                  <td className="px-4 py-2.5 text-right font-mono">
                    {EXAM_PATTERN.sections.reduce((sum, section) => sum + section.count, 0)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-muted">
                    {SECTION_IDS.reduce((sum, id) => sum + (counts[id] ?? 0), 0)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <h2 className="text-sm font-semibold">Marking</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">Correct</dt>
                <dd className="font-mono text-ok">+1.00</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Wrong</dt>
                <dd className="font-mono text-bad">−0.25</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Skipped</dt>
                <dd className="font-mono">0.00</dd>
              </div>
              <div className="flex justify-between border-t border-line pt-2">
                <dt className="text-muted">Pass mark</dt>
                <dd className="font-mono">{EXAM_PATTERN.passMark}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Target</dt>
                <dd className="font-mono text-accent">{EXAM_PATTERN.targetMark}</dd>
              </div>
            </dl>
          </Card>

          <Card>
            <h2 className="text-sm font-semibold">How questions are picked</h2>
            <ol className="mt-3 space-y-2 text-sm leading-5 text-muted">
              <li>1. Questions you have never seen.</li>
              <li>2. Questions you answered wrong most often.</li>
              <li>3. A random draw to fill the remaining quota.</li>
            </ol>
            <p className="mt-3 text-xs leading-5 text-muted">
              The bank currently holds {SECTION_IDS.reduce((sum, id) => sum + (counts[id] ?? 0), 0)}{" "}
              published questions.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
