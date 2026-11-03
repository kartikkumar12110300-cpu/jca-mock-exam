"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RichText } from "@/components/rich-text";
import type { RunnerPayload } from "@/lib/runner-types";
import { cn, formatDuration } from "@/lib/utils";

const LETTERS = ["A", "B", "C", "D"] as const;

type Phase = "active" | "submitting" | "error";

export default function Runner({ payload }: { payload: RunnerPayload }) {
  const router = useRouter();
  const { questions, sections } = payload;

  const [answers, setAnswers] = useState<Record<string, number | null>>(() => {
    const initial: Record<string, number | null> = {};
    for (const q of questions) initial[q.id] = payload.saved[q.id]?.selectedIndex ?? null;
    return initial;
  });

  const [marked, setMarked] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const q of questions) initial[q.id] = payload.saved[q.id]?.markedForReview ?? false;
    return initial;
  });

  const [index, setIndex] = useState(0);
  const indexRef = useRef(0);
  indexRef.current = index;
  const [phase, setPhase] = useState<Phase>("active");
  const [confirming, setConfirming] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(() => Date.now());

  // Server clock is authoritative; correct for any skew once, at mount.
  const skewRef = useRef<number | null>(null);
  if (skewRef.current === null) skewRef.current = payload.serverNow - Date.now();

  const remaining = Math.max(
    0,
    Math.ceil((payload.endsAt - (tick + (skewRef.current ?? 0))) / 1000),
  );

  const answersRef = useRef(answers);
  answersRef.current = answers;
  const markedRef = useRef(marked);
  markedRef.current = marked;

  const dirtyRef = useRef<Set<string>>(new Set());
  const timeRef = useRef<Record<string, number>>({});
  const flushingRef = useRef(false);
  const submittingRef = useRef(false);
  const storageKey = `jca:attempt:${payload.attemptId}`;

  // ---------------------------------------------------------------- timer
  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  // Per-question time, accumulated when leaving a question.
  useEffect(() => {
    const q = questions[index];
    if (!q) return;
    const startedAt = Date.now();
    const times = timeRef.current;
    return () => {
      times[q.id] = (times[q.id] ?? 0) + (Date.now() - startedAt);
    };
  }, [index, questions]);

  // ------------------------------------------------------------- autosave
  const flush = useCallback(async () => {
    if (flushingRef.current) return;
    const ids = [...dirtyRef.current];
    if (ids.length === 0) return;

    flushingRef.current = true;
    try {
      const res = await fetch(`/api/attempts/${payload.attemptId}/answers`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          answers: ids.map((questionId) => ({
            questionId,
            selectedIndex: answersRef.current[questionId] ?? null,
            markedForReview: Boolean(markedRef.current[questionId]),
            timeSpentMs: Math.round(timeRef.current[questionId] ?? 0),
          })),
        }),
      });
      if (res.ok) for (const id of ids) dirtyRef.current.delete(id);
    } catch {
      // The localStorage mirror covers a failed save; the next change retries.
    } finally {
      flushingRef.current = false;
    }
  }, [payload.attemptId]);

  useEffect(() => {
    if (phase !== "active") return;
    const id = setTimeout(() => void flush(), 700);
    return () => clearTimeout(id);
  }, [answers, marked, phase, flush]);

  // Crash insurance: mirror to localStorage and restore anything the server missed.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        answers?: Record<string, number | null>;
        marked?: Record<string, boolean>;
        index?: number;
      };

      if (typeof parsed.index === "number" && parsed.index >= 0 && parsed.index < questions.length) {
        indexRef.current = parsed.index;
        setIndex(parsed.index);
      }

      if (!parsed.answers) return;

      setAnswers((prev) => {
        const next = { ...prev };
        for (const q of questions) {
          if (next[q.id] == null && parsed.answers?.[q.id] != null) {
            next[q.id] = parsed.answers[q.id];
            dirtyRef.current.add(q.id);
          }
        }
        return next;
      });
    } catch {
      // ignore corrupt mirror
    }
  }, [storageKey, questions]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ answers, marked, index }));
    } catch {
      // storage full or disabled — the server copy is still authoritative
    }
  }, [answers, marked, index, storageKey]);

  // --------------------------------------------------------------- submit
  const submit = useCallback(async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setConfirming(false);
    setPhase("submitting");

    try {
      await flush();
      const res = await fetch(`/api/attempts/${payload.attemptId}/submit`, {
        method: "POST",
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Could not submit the paper.");

      try {
        localStorage.removeItem(storageKey);
      } catch {
        // non-fatal
      }
      router.replace(`/attempt/${payload.attemptId}/result`);
    } catch (err) {
      submittingRef.current = false;
      setPhase("error");
      setError(err instanceof Error ? err.message : "Could not submit the paper.");
    }
  }, [flush, payload.attemptId, router, storageKey]);

  // Auto-submit on the bell.
  useEffect(() => {
    if (phase === "active" && remaining <= 0) void submit();
  }, [phase, remaining, submit]);

  // ------------------------------------------------------------ navigation
  const go = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(questions.length - 1, next));
      indexRef.current = clamped;
      setIndex(clamped);
      setPaletteOpen(false);
    },
    [questions.length],
  );

  const choose = useCallback(
    (option: number) => {
      const q = questions[indexRef.current];
      if (!q) return;
      setAnswers((prev) => ({ ...prev, [q.id]: option }));
      dirtyRef.current.add(q.id);
    },
    [questions],
  );

  const clear = useCallback(() => {
    const q = questions[indexRef.current];
    if (!q) return;
    setAnswers((prev) => ({ ...prev, [q.id]: null }));
    dirtyRef.current.add(q.id);
  }, [questions]);

  const toggleMark = useCallback(() => {
    const q = questions[indexRef.current];
    if (!q) return;
    setMarked((prev) => ({ ...prev, [q.id]: !prev[q.id] }));
    dirtyRef.current.add(q.id);
  }, [questions]);

  // --------------------------------------------------------------- keyboard
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (phase !== "active" || confirming) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;

      const key = event.key.toLowerCase();

      if (["1", "2", "3", "4"].includes(key)) {
        event.preventDefault();
        choose(Number(key) - 1);
      } else if (["a", "b", "c", "d"].includes(key)) {
        event.preventDefault();
        choose(LETTERS.indexOf(key.toUpperCase() as (typeof LETTERS)[number]));
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        go(indexRef.current + 1);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        go(indexRef.current - 1);
      } else if (key === "m") {
        event.preventDefault();
        toggleMark();
      } else if (key === "s" || event.key === "Enter") {
        event.preventDefault();
        go(indexRef.current + 1);
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [choose, confirming, go, phase, toggleMark]);

  // ---------------------------------------------------------------- derived
  const current = questions[index];
  const section = useMemo(
    () => sections.find((s) => index >= s.start && index < s.end),
    [index, sections],
  );

  const answeredCount = questions.reduce(
    (n, q) => (answers[q.id] != null ? n + 1 : n),
    0,
  );
  const markedCount = questions.reduce((n, q) => (marked[q.id] ? n + 1 : n), 0);
  const unansweredCount = questions.length - answeredCount;

  if (!current) {
    return <p className="p-8 text-sm text-muted">This paper has no questions.</p>;
  }

  const palette = (
    <div className="space-y-4">
      {sections.map((s) => (
        <div key={s.id}>
          <div className="mb-1.5 flex justify-between text-[11px] uppercase tracking-wider text-muted">
            <span>{s.short}</span>
            <span className="font-mono">
              {s.start + 1}–{s.end}
            </span>
          </div>
          <div className="grid grid-cols-6 gap-1.5">
            {questions.slice(s.start, s.end).map((q, offset) => {
              const i = s.start + offset;
              const isAnswered = answers[q.id] != null;
              const isMarked = Boolean(marked[q.id]);
              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => go(i)}
                  aria-label={`Question ${i + 1}${isAnswered ? ", answered" : ""}${isMarked ? ", marked for review" : ""}`}
                  aria-current={i === index ? "true" : undefined}
                  className={cn(
                    "relative grid aspect-square place-items-center rounded border font-mono text-xs transition",
                    i === index && "ring-2 ring-accent ring-offset-1 ring-offset-surface",
                    isMarked
                      ? "border-accent/60 bg-accent/15 text-accent"
                      : isAnswered
                        ? "border-ok/50 bg-ok/15 text-ok"
                        : "border-line text-muted hover:border-muted",
                  )}
                >
                  {i + 1}
                  {isMarked && isAnswered ? (
                    <span className="absolute right-1 top-1 size-1 rounded-full bg-ok" />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <div className="flex flex-wrap gap-3 border-t border-line pt-3 text-[11px] text-muted">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-sm border border-ok/50 bg-ok/15" /> answered
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-sm border border-accent/60 bg-accent/15" /> marked
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-sm border border-line" /> untouched
        </span>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b border-line bg-canvas/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="rounded-md border border-line px-2.5 py-1.5 text-xs text-muted lg:hidden"
          >
            Palette
          </button>

          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{section?.short ?? "Paper"}</div>
            <div className="text-xs text-muted">
              {answeredCount}/{questions.length} answered · {markedCount} marked
            </div>
          </div>

          <div
            className={cn(
              "font-mono text-lg tabular-nums",
              remaining <= 300 ? "text-bad" : "text-ink",
            )}
            aria-live="off"
          >
            {formatDuration(remaining)}
          </div>

          <button
            type="button"
            onClick={() => setConfirming(true)}
            disabled={phase !== "active"}
            className="rounded-md bg-accent px-3.5 py-1.5 text-sm font-semibold text-canvas transition hover:brightness-110 disabled:opacity-50"
          >
            Submit
          </button>
        </div>
      </header>

      {error ? (
        <div className="border-b border-bad/40 bg-bad/10 px-4 py-2 text-center text-sm text-bad">
          {error}{" "}
          <button type="button" onClick={() => void submit()} className="underline">
            Retry
          </button>
        </div>
      ) : null}

      <main className="mx-auto grid w-full max-w-7xl flex-1 gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section>
          <div className="rounded-xl border border-line bg-surface p-6">
            <div className="flex items-center justify-between text-xs uppercase tracking-widest text-muted">
              <span>
                Question {index + 1} of {questions.length}
              </span>
              <span className="flex items-center gap-2">
                {current.isBonus ? (
                  <span className="rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[10px] text-accent">
                    bonus
                  </span>
                ) : null}
                {section?.short}
              </span>
            </div>

            <RichText
              text={current.stem}
              className="mt-4 block whitespace-pre-wrap text-[15px] leading-relaxed"
            />

            <div role="radiogroup" aria-label="Answer options" className="mt-5 space-y-2.5">
              {current.options.map((option, i) => {
                const selected = answers[current.id] === i;
                return (
                  <button
                    key={i}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => choose(i)}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-lg border px-4 py-3 text-left text-sm transition",
                      selected
                        ? "border-accent bg-accent/10"
                        : "border-line bg-surface-2 hover:border-muted/50",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border font-mono text-xs",
                        selected
                          ? "border-accent bg-accent text-canvas"
                          : "border-line text-muted",
                      )}
                    >
                      {LETTERS[i]}
                    </span>
                    <span className="leading-relaxed">{option}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => go(index - 1)}
              disabled={index === 0}
              className="rounded-md border border-line px-3.5 py-2 text-sm text-muted transition hover:text-ink disabled:opacity-40"
            >
              ← Previous
            </button>

            <button
              type="button"
              onClick={clear}
              disabled={answers[current.id] == null}
              className="rounded-md border border-line px-3.5 py-2 text-sm text-muted transition hover:text-ink disabled:opacity-40"
            >
              Clear
            </button>

            <button
              type="button"
              onClick={toggleMark}
              className={cn(
                "rounded-md border px-3.5 py-2 text-sm transition",
                marked[current.id]
                  ? "border-accent/60 bg-accent/10 text-accent"
                  : "border-line text-muted hover:text-ink",
              )}
            >
              {marked[current.id] ? "Unmark" : "Mark for review"}
            </button>

            <button
              type="button"
              onClick={() => go(index + 1)}
              disabled={index === questions.length - 1}
              className="ml-auto rounded-md bg-surface-2 px-4 py-2 text-sm font-medium transition hover:bg-line disabled:opacity-40"
            >
              Save &amp; next →
            </button>
          </div>

          <p className="mt-4 text-xs text-muted">
            Keys: <kbd className="rounded border border-line px-1">1–4</kbd> or{" "}
            <kbd className="rounded border border-line px-1">A–D</kbd> to answer ·{" "}
            <kbd className="rounded border border-line px-1">←/→</kbd> to move ·{" "}
            <kbd className="rounded border border-line px-1">M</kbd> to mark
          </p>
        </section>

        <aside className="hidden lg:block">
          <div className="sticky top-20 rounded-xl border border-line bg-surface p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">
                Palette
              </h2>
              <span className="font-mono text-xs text-muted">
                {unansweredCount} left
              </span>
            </div>
            {palette}
          </div>
        </aside>
      </main>

      {paletteOpen ? (
        <div className="fixed inset-0 z-40 bg-black/70 lg:hidden" onClick={() => setPaletteOpen(false)}>
          <div
            className="absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-xl border-t border-line bg-surface p-5"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">
                Palette
              </h2>
              <button
                type="button"
                onClick={() => setPaletteOpen(false)}
                className="text-sm text-muted hover:text-ink"
              >
                Close
              </button>
            </div>
            {palette}
          </div>
        </div>
      ) : null}

      {confirming ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="submit-title"
            className="w-full max-w-md rounded-xl border border-line bg-surface p-6"
          >
            <h2 id="submit-title" className="text-lg font-semibold">
              Submit paper?
            </h2>
            <p className="mt-1 text-sm text-muted">
              The clock will stop and your answers will be scored. You cannot reopen
              this attempt.
            </p>

            <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg border border-line bg-surface-2 p-2">
                <dt className="text-[10px] uppercase tracking-widest text-muted">Answered</dt>
                <dd className="font-mono text-lg">{answeredCount}</dd>
              </div>
              <div className="rounded-lg border border-line bg-surface-2 p-2">
                <dt className="text-[10px] uppercase tracking-widest text-muted">Unanswered</dt>
                <dd className="font-mono text-lg text-accent">{unansweredCount}</dd>
              </div>
              <div className="rounded-lg border border-line bg-surface-2 p-2">
                <dt className="text-[10px] uppercase tracking-widest text-muted">Marked</dt>
                <dd className="font-mono text-lg">{markedCount}</dd>
              </div>
            </dl>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="rounded-md border border-line px-4 py-2 text-sm text-muted transition hover:text-ink"
              >
                Keep working
              </button>
              <button
                type="button"
                onClick={() => void submit()}
                className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-canvas transition hover:brightness-110"
              >
                Submit &amp; score
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {phase === "submitting" ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 text-sm text-ink">
          Scoring your paper…
        </div>
      ) : null}
    </div>
  );
}
