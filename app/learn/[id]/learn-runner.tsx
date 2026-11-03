"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { RichText } from "@/components/rich-text";
import type { LearnPayload, LearnQuestion } from "@/lib/learn-types";
import { cn } from "@/lib/utils";

const LETTERS = ["A", "B", "C", "D"] as const;

type Phase = "active" | "submitting" | "error";

function isRight(question: LearnQuestion, choice: number | null): boolean {
  if (choice == null) return false;
  if (question.isBonus) return true;
  return choice === question.correctIndex;
}

export default function LearnRunner({ payload }: { payload: LearnPayload }) {
  const router = useRouter();
  const { questions, pageSize, attemptId } = payload;

  const [answers, setAnswers] = useState<Record<string, number | null>>(() => {
    const initial: Record<string, number | null> = {};
    for (const q of questions) initial[q.id] = payload.saved[q.id] ?? null;
    return initial;
  });

  const pages = Math.max(1, Math.ceil(questions.length / pageSize));

  const [page, setPage] = useState(() => {
    const firstUnanswered = questions.findIndex((q) => payload.saved[q.id] == null);
    return firstUnanswered < 0 ? Math.max(0, pages - 1) : Math.floor(firstUnanswered / pageSize);
  });

  const [phase, setPhase] = useState<Phase>("active");
  const [error, setError] = useState<string | null>(null);

  const pageStart = page * pageSize;
  const pageQuestions = questions.slice(pageStart, pageStart + pageSize);
  const lastPage = page >= pages - 1;

  const answeredTotal = questions.reduce((n, q) => (answers[q.id] != null ? n + 1 : n), 0);
  const correctTotal = questions.reduce((n, q) => (isRight(q, answers[q.id]) ? n + 1 : n), 0);
  const pageAnswered = pageQuestions.reduce((n, q) => (answers[q.id] != null ? n + 1 : n), 0);
  const pageCorrect = pageQuestions.reduce((n, q) => (isRight(q, answers[q.id]) ? n + 1 : n), 0);

  const overallPercent = questions.length === 0 ? 0 : (answeredTotal / questions.length) * 100;

  const saveOne = useCallback(
    async (questionId: string, selectedIndex: number) => {
      try {
        const res = await fetch(`/api/attempts/${attemptId}/answers`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          keepalive: true,
          body: JSON.stringify({ answers: [{ questionId, selectedIndex }] }),
        });
        if (!res.ok) setError("That answer could not be saved — it is still marked here.");
      } catch {
        setError("That answer could not be saved — it is still marked here.");
      }
    },
    [attemptId],
  );

  const choose = useCallback(
    (question: LearnQuestion, option: number) => {
      if (answers[question.id] != null) return;
      setAnswers((prev) => (prev[question.id] != null ? prev : { ...prev, [question.id]: option }));
      setError(null);
      void saveOne(question.id, option);
    },
    [answers, saveOne],
  );

  const finish = useCallback(async () => {
    const unanswered = questions.length - answeredTotal;
    if (
      unanswered > 0 &&
      !window.confirm(
        `${unanswered} question${unanswered === 1 ? "" : "s"} still unanswered. Finish the session anyway?`,
      )
    ) {
      return;
    }

    setPhase("submitting");
    setError(null);

    try {
      // Send the whole set once more so a failed earlier save cannot be lost.
      const res = await fetch(`/api/attempts/${attemptId}/answers`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          answers: questions.map((q) => ({
            questionId: q.id,
            selectedIndex: answers[q.id] ?? null,
          })),
        }),
      });
      if (!res.ok) throw new Error("Could not save your answers.");

      const submitted = await fetch(`/api/attempts/${attemptId}/submit`, { method: "POST" });
      const data = (await submitted.json()) as { ok: boolean; error?: string };
      if (!submitted.ok || !data.ok) {
        throw new Error(data.error ?? "Could not finish the session.");
      }

      router.replace(`/attempt/${attemptId}/result`);
    } catch (err) {
      setPhase("error");
      setError(err instanceof Error ? err.message : "Could not finish the session.");
    }
  }, [answeredTotal, answers, attemptId, questions, router]);

  const summary = useMemo(
    () => [
      { label: "Answered", value: `${answeredTotal}/${questions.length}` },
      { label: "Correct", value: String(correctTotal), tone: "text-ok" },
      {
        label: "Accuracy",
        value: answeredTotal === 0 ? "—" : `${Math.round((correctTotal / answeredTotal) * 100)}%`,
      },
    ],
    [answeredTotal, correctTotal, questions.length],
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Learn mode</h1>
          <p className="mt-1 text-sm text-muted">
            Answers are marked instantly, with the explanation. An answer locks once you pick
            it — that is what makes it a learning rep rather than a guess.
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
            style={{ width: `${overallPercent}%` }}
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
        <p
          role="status"
          className="mt-3 rounded-lg border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-bad"
        >
          {error}
        </p>
      ) : null}

      <div className="mt-5 space-y-4">
        {pageQuestions.map((q, offset) => {
          const number = pageStart + offset + 1;
          const choice = answers[q.id];
          const answered = choice != null;
          const right = isRight(q, choice);
          const showKey = answered && !q.isBonus;

          return (
            <article key={q.id} className="rounded-xl border border-line bg-surface p-5">
              <div className="flex items-center justify-between gap-3 text-xs text-muted">
                <span className="font-mono">
                  Q{number} · {q.sectionShort}
                </span>
                {answered ? (
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider",
                      q.isBonus
                        ? "border-accent/40 bg-accent/10 text-accent"
                        : right
                          ? "border-ok/40 bg-ok/10 text-ok"
                          : "border-bad/40 bg-bad/10 text-bad",
                    )}
                  >
                    {q.isBonus ? "bonus" : right ? "correct" : "incorrect"}
                  </span>
                ) : null}
              </div>

              <RichText
                text={q.stem}
                className="mt-2 block whitespace-pre-wrap text-[15px] leading-relaxed"
              />

              <div
                role="radiogroup"
                aria-label={`Question ${number} options`}
                className="mt-4 space-y-2"
              >
                {q.options.map((option, i) => {
                  const isChosen = choice === i;
                  const isKey = showKey && q.correctIndex === i;

                  return (
                    <button
                      key={i}
                      type="button"
                      role="radio"
                      aria-checked={isChosen}
                      disabled={answered}
                      onClick={() => choose(q, i)}
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
                        {LETTERS[i]}
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
                  <p className={cn("text-sm font-medium", q.isBonus || right ? "text-ok" : "text-bad")}>
                    {q.isBonus
                      ? "Bonus question — full marks to everyone."
                      : right
                        ? "Correct."
                        : `Not quite — the answer is ${LETTERS[q.correctIndex ?? 0]}.`}
                  </p>
                  {q.explanation ? (
                    <p className="mt-1.5 border-l-2 border-accent/40 pl-3 text-xs leading-relaxed text-muted">
                      {q.explanation}
                    </p>
                  ) : null}
                  {q.sourceRef ? (
                    <p className="mt-2 text-[10px] uppercase tracking-wider text-muted/70">
                      {q.sourceRef}
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
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          disabled={page === 0 || phase !== "active"}
          className="rounded-md border border-line px-3.5 py-2 text-sm text-muted transition hover:text-ink disabled:opacity-40"
        >
          ← Previous page
        </button>

        {lastPage ? (
          <button
            type="button"
            onClick={() => void finish()}
            disabled={phase !== "active"}
            className="ml-auto rounded-md bg-accent px-5 py-2 text-sm font-semibold text-canvas transition hover:brightness-110 disabled:opacity-50"
          >
            {phase === "submitting" ? "Saving…" : "Finish session"}
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => void finish()}
              disabled={phase !== "active"}
              className="ml-auto text-xs text-muted transition hover:text-ink disabled:opacity-40"
            >
              Finish early
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
              disabled={phase !== "active"}
              className="rounded-md bg-surface-2 px-4 py-2 text-sm font-medium transition hover:bg-line disabled:opacity-40"
            >
              Next page →
            </button>
          </>
        )}
      </div>

      <p className="mt-3 text-xs text-muted">
        Page {page + 1} has {pageAnswered}/{pageQuestions.length} answered. Answers save as you
        go, so you can close this tab and resume later.
      </p>
    </div>
  );
}
