import Link from "next/link";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth/guards";
import { listMistakes } from "@/lib/exam/queries";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function MistakesPage() {
  const user = await requireUser();
  const mistakes = await listMistakes(user.id);

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Mistake notebook"
        title="What you got wrong"
        description="Every wrong answer you have saved, newest first. Fix the pattern, not just the question."
        action={
          <Link
            href="/drill"
            className="rounded-md border border-line px-4 py-2 text-sm text-muted transition hover:border-accent/50 hover:text-ink"
          >
            Drill these areas
          </Link>
        }
      />

      {mistakes.length === 0 ? (
        <EmptyState
          title="No mistakes recorded yet"
          description="Once you submit a paper or drill, every wrong answer lands here with the correct option and explanation."
          action={
            <Link
              href="/new"
              className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-canvas transition hover:brightness-110"
            >
              Start a full mock
            </Link>
          }
        />
      ) : (
        <ol className="space-y-4">
          {mistakes.map((item) => (
            <li key={item.questionId}>
              <Card>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="blue">{item.section}</Badge>
                  {item.topic ? <Badge>{item.topic}</Badge> : null}
                  <span className="ml-auto text-xs text-muted">
                    Last missed {formatDateTime(item.lastAttemptAt)}
                  </span>
                </div>

                <p className="mt-3 whitespace-pre-line text-sm leading-6">{item.stem}</p>

                <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
                  {item.options.map((option, index) => {
                    const isCorrect = item.correctIndex === index;
                    const isChosen = item.selectedIndex === index;
                    return (
                      <li
                        key={index}
                        className={
                          isCorrect
                            ? "rounded-md border border-ok/50 bg-ok/10 px-3 py-2 text-sm"
                            : isChosen
                              ? "rounded-md border border-bad/50 bg-bad/10 px-3 py-2 text-sm"
                              : "rounded-md border border-line px-3 py-2 text-sm text-muted"
                        }
                      >
                        <span className="mr-2 font-mono text-xs text-muted">
                          {String.fromCharCode(65 + index)}
                        </span>
                        {option}
                        {isCorrect ? (
                          <span className="ml-2 text-xs font-medium text-ok">correct</span>
                        ) : null}
                        {isChosen ? (
                          <span className="ml-2 text-xs font-medium">your answer</span>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>

                {item.explanation ? (
                  <p className="mt-3 rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-sm leading-6 text-muted">
                    {item.explanation}
                  </p>
                ) : null}
              </Card>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
