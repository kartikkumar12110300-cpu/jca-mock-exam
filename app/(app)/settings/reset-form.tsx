"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface ClearReport {
  attempts: number;
  papers: number;
  answers: number;
}

export function ResetForm({ attempts, papers }: { attempts: number; papers: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const empty = attempts === 0 && papers === 0;

  async function onClick() {
    const confirmed = window.confirm(
      `Delete ${attempts} attempt(s) and ${papers} paper(s)?\n\n` +
        "Your question bank is kept. Scores, history, section mastery and the mistake notebook will be cleared. This cannot be undone.",
    );
    if (!confirmed) return;

    setBusy(true);
    setResult(null);

    try {
      const response = await fetch("/api/reset", { method: "POST" });
      const data = (await response.json()) as {
        ok: boolean;
        error?: string;
        report?: ClearReport;
      };

      if (!data.ok || !data.report) {
        setResult({ ok: false, text: data.error ?? "Could not clear the history." });
        return;
      }

      const r = data.report;
      setResult({
        ok: true,
        text: `Deleted ${r.attempts} attempt(s), ${r.papers} paper(s) and ${r.answers} answer(s).`,
      });
      router.refresh();
    } catch (error) {
      setResult({
        ok: false,
        text: error instanceof Error ? error.message : "Could not clear the history.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={onClick}
        disabled={busy || empty}
        className="rounded-md border border-bad/40 px-4 py-2 text-sm font-medium text-bad transition hover:border-bad/60 hover:bg-bad/5 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy ? "Clearing…" : "Delete all attempts"}
      </button>
      <p aria-live="polite" className="text-xs text-muted">
        {result ? (
          <span className={result.ok ? "text-ok" : "text-bad"}>{result.text}</span>
        ) : empty ? (
          "There is no practice history to clear."
        ) : (
          "The question bank is not touched."
        )}
      </p>
    </div>
  );
}
