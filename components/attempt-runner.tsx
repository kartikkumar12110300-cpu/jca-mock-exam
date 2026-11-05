"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn, formatClock } from "@/lib/utils";
import { sectionName } from "@/lib/exam/pattern";

interface RunnerQuestion {
  id: string;
  sectionId: string;
  topic: string;
  difficulty: string;
  stem: string;
  options: string[];
}

interface RunnerAnswer {
  questionId: string;
  selectedIndex: number | null;
  markedForReview: boolean;
  timeSpentMs: number;
}

interface Props {
  attemptId: string;
  title: string;
  endsAt: string;
  durationSec: number;
  questions: RunnerQuestion[];
  initialAnswers: RunnerAnswer[];
}

type AnswerMap = Record<string, RunnerAnswer>;

function remainingSeconds(endsAt: string): number {
  return Math.max(0, Math.floor((new Date(endsAt).getTime() - Date.now()) / 1000));
}

export function AttemptRunner({
  attemptId,
  title,
  endsAt,
  durationSec,
  questions,
  initialAnswers,
}: Props) {
  const router = useRouter();
  const initialMap = useMemo(() => {
    const map: AnswerMap = {};
    for (const answer of initialAnswers) map[answer.questionId] = { ...answer };
    return map;
  }, [initialAnswers]);

  const [answers, setAnswers] = useState<AnswerMap>(initialMap);
  const [current, setCurrent] = useState(0);
  const [remaining, setRemaining] = useState(() => remainingSeconds(endsAt));
  const [saving, setSaving] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [showPalette, setShowPalette] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const questionEnteredAt = useRef(Date.now());
  const timeByQuestion = useRef<Record<string, number>>(
    Object.fromEntries(initialAnswers.map((answer) => [answer.questionId, answer.timeSpentMs])),
  );
  const submittedRef = useRef(false);
  const queueRef = useRef<Promise<void>>(Promise.resolve());

  const question = questions[current];

  const submit = useCallback(
    async (auto = false) => {
      if (submittedRef.current) return;
      submittedRef.current = true;
      setSubmitting(true);
      setError(null);
      try {
        await queueRef.current;
        const response = await fetch(`/api/attempts/${attemptId}/submit`, {
          method: "POST",
        });
        if (!response.ok) {
          const data = (await response.json().catch(() => null)) as { error?: string } | null;
          if (response.status === 409 && auto) {
            router.replace(`/result/${attemptId}`);
            router.refresh();
            return;
          }
          submittedRef.current = false;
          setSubmitting(false);
          setError(data?.error || "Could not submit this paper.");
          return;
        }
        router.replace(`/result/${attemptId}`);
        router.refresh();
      } catch {
        submittedRef.current = false;
        setSubmitting(false);
        setError("Could not submit. Check your connection and try again.");
      }
    },
    [attemptId, router],
  );

  useEffect(() => {
    const timer = window.setInterval(() => {
      const next = remainingSeconds(endsAt);
      setRemaining(next);
      if (next <= 0) {
        window.clearInterval(timer);
        void submit(true);
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [endsAt, submit]);

  useEffect(() => {
    questionEnteredAt.current = Date.now();
  }, [current]);

  const goTo = useCallback(
    (index: number) => {
      if (index < 0 || index >= questions.length) return;
      const leaving = questions[current];
      if (leaving) {
        const spent = Date.now() - questionEnteredAt.current;
        timeByQuestion.current[leaving.id] =
          (timeByQuestion.current[leaving.id] ?? 0) + spent;
        questionEnteredAt.current = Date.now();
      }
      setCurrent(index);
    },
    [current, questions],
  );

  const persist = useCallback(
    (input: RunnerAnswer) => {
      queueRef.current = queueRef.current
        .then(async () => {
          setSaving("saving");
          const response = await fetch(`/api/attempts/${attemptId}/answers`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              questionId: input.questionId,
              selectedIndex: input.selectedIndex,
              markedForReview: input.markedForReview,
              timeSpentMs: input.timeSpentMs,
            }),
          });
          if (!response.ok) {
            const data = (await response.json().catch(() => null)) as { error?: string } | null;
            setSaving("error");
            setError(data?.error || "Autosave failed.");
            if (response.status === 409) {
              submittedRef.current = true;
              router.replace(`/result/${attemptId}`);
            }
            return;
          }
          setSaving("saved");
          setError(null);
        })
        .catch(() => {
          setSaving("error");
          setError("Autosave failed. Check your connection.");
        });
    },
    [attemptId, router],
  );

  const update = useCallback(
    (changes: Partial<RunnerAnswer>) => {
      if (!question) return;
      const existing = answers[question.id] ?? {
        questionId: question.id,
        selectedIndex: null,
        markedForReview: false,
        timeSpentMs: 0,
      };
      const spent = Date.now() - questionEnteredAt.current;
      questionEnteredAt.current = Date.now();
      timeByQuestion.current[question.id] = (timeByQuestion.current[question.id] ?? 0) + spent;
      const next: RunnerAnswer = {
        ...existing,
        ...changes,
        timeSpentMs: timeByQuestion.current[question.id] ?? 0,
      };
      setAnswers((value) => ({ ...value, [question.id]: next }));
      persist(next);
    },
    [answers, persist, question],
  );

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      const key = event.key.toLowerCase();
      const optionIndex = ["a", "b", "c", "d", "1", "2", "3", "4"].indexOf(key);
      if (optionIndex >= 0) {
        event.preventDefault();
        update({ selectedIndex: optionIndex % 4 });
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        goTo(current + 1);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        goTo(current - 1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, goTo, update]);

  const answeredCount = questions.filter(
    (item) => answers[item.id]?.selectedIndex !== null && answers[item.id]?.selectedIndex !== undefined,
  ).length;
  const markedCount = questions.filter((item) => answers[item.id]?.markedForReview).length;
  const progress = Math.round((answeredCount / questions.length) * 100);
  const urgent = remaining <= 300;

  const sections = useMemo(() => {
    const groups: { sectionId: string; items: RunnerQuestion[] }[] = [];
    for (const item of questions) {
      const last = groups[groups.length - 1];
      if (last && last.sectionId === item.sectionId) last.items.push(item);
      else groups.push({ sectionId: item.sectionId, items: [item] });
    }
    return groups;
  }, [questions]);

  function paletteClass(item: RunnerQuestion, isCurrent: boolean): string {
    const answer = answers[item.id];
    const answered = answer?.selectedIndex !== null && answer?.selectedIndex !== undefined;
    const marked = answer?.markedForReview;
    return cn(
      "grid size-8 place-items-center rounded-md border font-mono text-xs transition",
      isCurrent && "ring-2 ring-accent ring-offset-1 ring-offset-surface",
      marked
        ? "border-accent/60 bg-accent/15 text-accent"
        : answered
          ? "border-ok/50 bg-ok/15 text-ok"
          : "border-line bg-surface-2 text-muted hover:border-muted/60 hover:text-ink",
    );
  }

  if (!question) {
    return <p className="p-8 text-sm text-muted">This paper has no questions.</p>;
  }

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <header className="sticky top-0 z-20 border-b border-line bg-canvas/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{title}</p>
            <p className="text-xs text-muted">
              {answeredCount}/{questions.length} answered · {markedCount} marked ·{" "}
              {saving === "saving" ? "saving…" : saving === "error" ? "not saved" : "autosaved"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "rounded-lg border px-4 py-1.5 text-center",
                urgent
                  ? "border-bad/50 bg-bad/15 text-bad"
                  : "border-line bg-surface-2 text-ink",
              )}
            >
              <p className="text-[9px] uppercase tracking-[0.16em] text-muted">Time left</p>
              <p className="font-mono text-lg leading-tight">{formatClock(remaining)}</p>
            </div>
            <button
              type="button"
              onClick={() => setShowPalette((value) => !value)}
              className="rounded-md border border-line px-3 py-2 text-sm text-muted transition hover:text-ink lg:hidden"
            >
              Palette
            </button>
            <button
              type="button"
              onClick={() => {
                if (window.confirm("Submit this paper now? You cannot change answers afterwards.")) {
                  void submit();
                }
              }}
              disabled={submitting}
              className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-canvas transition hover:brightness-110 disabled:opacity-50"
            >
              {submitting ? "Submitting…" : "Submit"}
            </button>
          </div>
        </div>
        <div className="h-0.5 w-full bg-line">
          <div
            className="h-full bg-accent/80 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </header>

      {error ? (
        <div
          role="alert"
          className="border-b border-bad/40 bg-bad/10 px-4 py-2 text-center text-xs text-bad"
        >
          {error}
        </div>
      ) : null}

      <div className="mx-auto grid w-full max-w-7xl flex-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[1fr_280px]">
        <main>
          <div className="rounded-xl border border-line bg-surface p-5 sm:p-7">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full border border-ink/20 bg-ink/5 px-2.5 py-0.5 font-medium">
                {sectionName(question.sectionId)}
              </span>
              {question.topic ? (
                <span className="rounded-full border border-line bg-surface-2 px-2.5 py-0.5 text-muted">
                  {question.topic}
                </span>
              ) : null}
              <span className="ml-auto font-mono text-muted">
                Question {current + 1} of {questions.length}
              </span>
            </div>

            <p className="mt-4 whitespace-pre-line text-[15px] leading-7">{question.stem}</p>

            <div role="radiogroup" aria-label="Answer options" className="mt-5 grid gap-2">
              {question.options.map((option, index) => {
                const selected = answers[question.id]?.selectedIndex === index;
                return (
                  <button
                    key={index}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => update({ selectedIndex: selected ? null : index })}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-lg border px-4 py-3 text-left text-sm transition",
                      selected
                        ? "border-accent/70 bg-accent/10"
                        : "border-line bg-surface-2 hover:border-muted/50",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 grid size-6 shrink-0 place-items-center rounded-md border font-mono text-xs",
                        selected
                          ? "border-accent bg-accent text-canvas"
                          : "border-line text-muted",
                      )}
                    >
                      {String.fromCharCode(65 + index)}
                    </span>
                    <span className="leading-6">{option}</span>
                  </button>
                );
              })}
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-line pt-4">
              <button
                type="button"
                onClick={() => goTo(current - 1)}
                disabled={current === 0}
                className="rounded-md border border-line px-4 py-2 text-sm text-muted transition hover:text-ink disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => goTo(current + 1)}
                disabled={current === questions.length - 1}
                className="rounded-md border border-line px-4 py-2 text-sm text-muted transition hover:text-ink disabled:opacity-40"
              >
                Next
              </button>
              <button
                type="button"
                onClick={() => update({ markedForReview: !answers[question.id]?.markedForReview })}
                className={cn(
                  "rounded-md border px-4 py-2 text-sm transition",
                  answers[question.id]?.markedForReview
                    ? "border-accent/60 bg-accent/15 text-accent"
                    : "border-line text-muted hover:text-ink",
                )}
              >
                {answers[question.id]?.markedForReview ? "Unmark" : "Mark for review"}
              </button>
              <button
                type="button"
                onClick={() => update({ selectedIndex: null })}
                className="rounded-md border border-line px-4 py-2 text-sm text-muted transition hover:text-ink"
              >
                Clear
              </button>
              <span className="ml-auto hidden text-xs text-muted sm:inline">
                A–D select · ← → navigate
              </span>
            </div>
          </div>
        </main>

        <aside
          className={cn(
            "lg:block",
            showPalette
              ? "fixed inset-x-0 bottom-0 z-30 max-h-[70vh] overflow-y-auto rounded-t-2xl border-t border-line bg-surface p-4 lg:static lg:max-h-none lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0"
              : "hidden",
          )}
        >
          <div className="rounded-xl border border-line bg-surface p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Question palette</h2>
              <button
                type="button"
                onClick={() => setShowPalette(false)}
                className="text-xs text-muted lg:hidden"
              >
                Close
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-muted">
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-ok/70" /> Answered
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-accent/80" /> Marked
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-line" /> Unseen
              </span>
            </div>

            <div className="mt-4 space-y-4">
              {sections.map((group) => (
                <div key={`${group.sectionId}-${group.items[0]?.id}`}>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                    {sectionName(group.sectionId)}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {group.items.map((item) => {
                      const index = questions.findIndex((entry) => entry.id === item.id);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            goTo(index);
                            setShowPalette(false);
                          }}
                          aria-label={`Question ${index + 1}`}
                          className={paletteClass(item, index === current)}
                        >
                          {index + 1}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                if (window.confirm("Submit this paper now? You cannot change answers afterwards.")) {
                  void submit();
                }
              }}
              disabled={submitting}
              className="mt-5 w-full rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-canvas transition hover:brightness-110 disabled:opacity-50"
            >
              {submitting ? "Submitting…" : "Submit paper"}
            </button>
            <p className="mt-2 text-center text-[11px] text-muted">
              Total time {Math.round(durationSec / 60)} minutes
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
