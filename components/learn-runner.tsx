"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const LETTERS = ["A", "B", "C", "D"] as const;

export interface LearnQuestion {
  id: string;
  sectionShort: string;
  topic: string;
  stem: string;
  options: string[];
  correctIndex: number | null;
  isBonus: boolean;
  explanation: string;
  sourceRef: string | null;
}

interface Props {
  attemptId: string;
  pageSize: number;
  questions: LearnQuestion[];
  saved: Record<string, number | null>;
}

function isRight(question: LearnQuestion, choice: number | null): boolean {
  if (choice == null) return false;
  if (question.isBonus) return true;
  return choice === question.correctIndex;
}

export function LearnRunner({ attemptId, pageSize, questions, saved }: Props) {
  const router = useRouter();

  const [answers, setAnswers] = useState<Record<string, number | null>>(() => {
    const initial: Record<string, number | null> = {};
    for (const question of questions) initial[question.id] = saved[question.id] ?? null;
    return initial;
  });

  const pages = Math.max(1, Math.ceil(questions.length / pageSize));
  const [page, setPage] = useState(() => {
    const firstUnanswered = questions.findIndex((question) => saved[question.id] == null);
    return firstUnanswered < 0
      ? Math.max(0, pages - 1)
      : Math.floor(firstUnanswered / pageSize);
  });

  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Saves run in order; finishing waits for the queue so the last answer is not lost.
  const pendingRef = useRef<Promise<void>>(Promise.resolve());

  const pageStart = page * pageSize;
  const pageQuestions = questions.slice(pageStart, pageStart + pageSize);
  const lastPage = page >= pages - 1;

  const answeredTotal = questions.reduce(
    (count, question) => (answers[question.id] != null ? count + 1 : count),
    0,
  );
  const correctTotal = questions.reduce(
    (count, question) => (isRight(question, answers[question.id]) ? count + 1 : count),
    0,
  );
  const pageAnswered = pageQuestions.reduce(
    (count, question) => (answers[question.id] != null ? count + 1 : count),
    0,
  );
  const pageCorrect = pageQuestions.reduce(
    (count, question) => (isRight(question, answers[question.id]) ? count + 1 : count),
    0,
  );

  const summary = useMemo(
    () => [
      { label: "Answered", value: `${answeredTotal}/${questions.length}` },
      { label: "Correct", value: String(correctTotal), tone: "text-ok" },
      {
        label: "Accuracy",
        value:
          answeredTotal === 0
            ? "—"
            : `${Math.round((correctTotal / answeredTotal) * 100)}%`,
      },
    ],
    [answeredTotal, correctTotal, questions.length],
  );

  const saveOne = useCallback(
    async (questionId: string, selectedIndex: number) => {
      try {
        const response = await fetch(`/api/attempts/${attemptId}/answers`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          keepalive: true,
          body: JSON.stringify({ questionId, selectedIndex }),
        });
        if (!response.ok && response.status !== 409) {
          setError("That answer could not be saved — it is still marked here.");
        }
      } catch {
        setError("That answer could not be saved — it is still marked here.");
      }
    },
    [attemptId],
  );

  const choose = useCallback(
    (question: LearnQuestion, option: number) => {
      if (answers[question.id] != null) return;
      setAnswers((previous) =>
        previous[question.id] != null
          ? previous
          : { ...previous, [question.id]: option },
      );
      setError(null);
      pendingRef.current = pendingRef.current.then(() => saveOne(question.id, option));
    },
    [answers, saveOne],
  );

  const finish = useCallback(async () => {
    const unanswered = questions.filter((question) => answers[question.id] == null);
    if (
      unanswered.length > 0 &&
      !window.confirm(
        `${unanswered.length} question${unanswered.length === 1 ? "" : "s"} still unanswered. Finish the session anyway?`,
      )
    ) {
      return;
    }

    setFinishing(true);
    setError(null);

    try {
      // Let the last autosave land before the paper is scored.
      await pendingRef.current;

      // Retry only the unanswered ones; every saved answer is already locked.
      await Promise.all(
        unanswered.map((question) =>
          fetch(`/api/attempts/${attemptId}/answers`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ questionId: question.id, selectedIndex: null }),
          }),
        ),
      );

      const submitted = await fetch(`/api/attempts/${attemptId}/submit`, {
        method: "POST",
      });
      const data = (await submitted.json()) as { ok?: boolean; error?: string };
      if (!submitted.ok || !data.ok) {
        throw new Error(data.error || "Could not finish the session.");
      }

      router.replace(`/result/${attemptId}`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not finish the session.");
      setFinishing(false);
    }
  }, [answers, attemptId, questions, router]);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
            <span aria-hidden className="h-px w-6 bg-accent/50" />
            Learn mode
          </p>
          <h1 className="mt-2 text-xl font-semibold tracking-tight">
            {pages} page{pages === 1 ? "" : "s"} · {questions.length} questions
          </h1>
          <p className="mt-1 text-sm text-muted">
            Answers lock once you pick them, so read the explanation before moving on.
          </p>
        </div>
        <span className="font-mono text-xs text-muted">
          Page {page + 1} of {pages}
        </span>
      </div>

      <div className="mt-4 rounded-xl border border-line bg-surface p-4">
        <div className="flex items-center justify-between text-xs text-muted">
          <span>
            {answeredTotal} of {questions.length} answered
          </span>
          <span className="font-mono">
            {correctTotal} correct
            {pageAnswered > 0 ? ` · ${pageCorrect}/${pageAnswered} this page` : ""}
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
          <div
            className="h-full rounded-full bg-accent/80 transition-[width]"
            style={{
              width: `${questions.length === 0 ? 0 : (answeredTotal / questions.length) * 100}%`,
            }}
          />
        </div>
        <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
          {summary.map((stat) => (
            <div key={stat.label} className="rounded-lg border border-line bg-surface-2 px-2 py-1.5">
              <dt className="text-[10px] uppercase tracking-widest text-muted">{stat.label}</dt>
              <dd className={cn("font-mono text-sm", stat.tone)}>{stat.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {error ? (
        <p role="status" className="mt-3 rounded-lg border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-bad">
          {error}
        </p>
      ) : null}

      <div className="mt-5 space-y-4">
        {pageQuestions.map((question, offset) => {
          const number = pageStart + offset + 1;
          const choice = answers[question.id];
          const answered = choice != null;
          const right = isRight(question, choice);
          const showKey = answered && !question.isBonus;

          return (
            <article key={question.id} className="rounded-xl border border-line bg-surface p-5">
              <div className="flex items-center justify-between gap-3 text-xs text-muted">
                <span className="font-mono">
                  Q{number} · {question.sectionShort}
                  {question.topic ? ` · ${question.topic}` : ""}
                </span>
                {answered ? (
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider",
                      question.isBonus
                        ? "border-accent/40 bg-accent/10 text-accent"
                        : right
                          ? "border-ok/40 bg-ok/10 text-ok"
                          : "border-bad/40 bg-bad/10 text-bad",
                    )}
                  >
                    {question.isBonus ? "bonus" : right ? "correct" : "incorrect"}
                  </span>
                ) : null}
              </div>

              <p className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed">{question.stem}</p>

              <div
                role="radiogroup"
                aria-label={`Question ${number} options`}
                className="mt-4 space-y-2"
              >
                {question.options.map((option, index) => {
                  const isChosen = choice === index;
                  const isKey = showKey && question.correctIndex === index;

                  return (
                    <button
                      key={index}
                      type="button"
                      role="radio"
                      aria-checked={isChosen}
                      disabled={answered}
                      onClick={() => choose(question, index)}
                      className={cn(
                        "flex w-full items-start gap-3 rounded-lg border px-4 py-2.5 text-left text-sm transition",
                        isKey
                          ? "border-ok/60 bg-ok/10"
                          : isChosen
                            ? "border-bad/60 bg-bad/10"
                            : answered
                              ? "border-line/60 bg-surface-2 opacity-60"
                              : "border-line bg-surface-2 hover:border-muted/50",
                        answered && "cursor-default",
                      )}
                    >
                      <span
                        className={cn(
                          "mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border font-mono text-xs",
                          isKey
                            ? "border-ok bg-ok text-canvas"
                            : isChosen
                              ? "border-bad bg-bad text-canvas"
                              : "border-line text-muted",
                        )}
                      >
                        {LETTERS[index]}
                      </span>
                      <span className="flex-1 leading-relaxed">{option}</span>
                      {isChosen ? (
                        <span className="mt-0.5 text-[10px] uppercase tracking-wider text-muted">
                          your answer
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>

              {answered ? (
                <div className="mt-3 border-t border-line/60 pt-3">
                  <p className={cn("text-sm font-medium", question.isBonus || right ? "text-ok" : "text-bad")}>
                    {question.isBonus
                      ? "Bonus question — full marks to everyone."
                      : right
                        ? "Correct."
                        : `Not quite — the answer is ${LETTERS[question.correctIndex ?? 0]}.`}
                  </p>
                  {question.explanation ? (
                    <p className="mt-1.5 border-l-2 border-accent/40 pl-3 text-xs leading-relaxed text-muted">
                      {question.explanation}
                    </p>
                  ) : null}
                  {question.sourceRef ? (
                    <p className="mt-2 text-[10px] uppercase tracking-wider text-muted">
                      {question.sourceRef}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-line pt-4">
        <button
          type="button"
          onClick={() => setPage((value) => Math.max(0, value - 1))}
          disabled={page === 0 || finishing}
          className="rounded-md border border-line px-3.5 py-2 text-sm text-muted transition hover:text-ink disabled:opacity-40"
        >
          ← Previous page
        </button>

        {lastPage ? (
          <button
            type="button"
            onClick={() => void finish()}
            disabled={finishing}
            className="ml-auto rounded-md bg-accent px-5 py-2 text-sm font-semibold text-canvas transition hover:brightness-110 disabled:opacity-50"
          >
            {finishing ? "Saving…" : "Finish session"}
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => void finish()}
              disabled={finishing}
              className="ml-auto text-xs text-muted transition hover:text-ink disabled:opacity-40"
            >
              Finish early
            </button>
            <button
              type="button"
              onClick={() => setPage((value) => Math.min(pages - 1, value + 1))}
              disabled={finishing}
              className="rounded-md bg-surface-2 px-4 py-2 text-sm font-medium transition hover:bg-line disabled:opacity-40"
            >
              Next page →
            </button>
          </>
        )}
      </div>

      <p className="mt-3 text-xs text-muted">
        Page {page + 1} has {pageAnswered}/{pageQuestions.length} answered. Answers save as you go,
        so you can close this tab and resume later.
      </p>
    </div>
  );
}
