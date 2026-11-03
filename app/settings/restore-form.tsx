"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

type Mode = "merge" | "replace";

interface RestoreReport {
  questions: number;
  tests: number;
  attempts: number;
  answers: number;
  skipped: number;
}

export function RestoreForm() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<Mode>("merge");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const file = inputRef.current?.files?.[0];
    if (!file) {
      setResult({ ok: false, text: "Choose a backup file first." });
      return;
    }

    if (
      mode === "replace" &&
      !window.confirm(
        "Replace everything? Every question, paper and attempt on this machine will be deleted and replaced by the backup. This cannot be undone.",
      )
    ) {
      return;
    }

    setBusy(true);
    setResult(null);

    try {
      const body = new FormData();
      body.set("file", file);
      body.set("mode", mode);

      const response = await fetch("/api/restore", { method: "POST", body });
      const data = (await response.json()) as {
        ok: boolean;
        error?: string;
        report?: RestoreReport;
      };

      if (!data.ok || !data.report) {
        setResult({ ok: false, text: data.error ?? "Restore failed." });
        return;
      }

      const r = data.report;
      setResult({
        ok: true,
        text:
          `Restored ${r.questions} question(s), ${r.tests} paper(s), ` +
          `${r.attempts} attempt(s) and ${r.answers} answer(s).` +
          (r.skipped > 0 ? ` ${r.skipped} row(s) skipped (already present or missing here).` : ""),
      });
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    } catch (error) {
      setResult({
        ok: false,
        text: error instanceof Error ? error.message : "Restore failed.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 space-y-4">
      <div>
        <label
          htmlFor="backup-file"
          className="text-[11px] font-medium uppercase tracking-widest text-muted"
        >
          Backup file
        </label>
        <input
          ref={inputRef}
          id="backup-file"
          name="file"
          type="file"
          accept="application/json,.json"
          className="mt-1.5 block w-full cursor-pointer rounded-md border border-line bg-surface-2 px-3 py-2 text-sm text-muted file:mr-3 file:rounded file:border-0 file:bg-accent/15 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-accent hover:file:brightness-110"
        />
      </div>

      <fieldset>
        <legend className="text-[11px] font-medium uppercase tracking-widest text-muted">
          How to restore
        </legend>
        <div className="mt-2 space-y-2">
          {(
            [
              {
                id: "merge",
                label: "Merge",
                hint: "Keep what is here and add anything missing. Safe to repeat.",
              },
              {
                id: "replace",
                label: "Replace everything",
                hint: "Delete this machine's data and load the backup exactly.",
              },
            ] as Array<{ id: Mode; label: string; hint: string }>
          ).map((option) => (
            <label
              key={option.id}
              className="flex cursor-pointer items-start gap-3 rounded-lg border border-line bg-surface-2 px-3.5 py-2.5 transition has-checked:border-accent/60 has-checked:bg-accent/5"
            >
              <input
                type="radio"
                name="mode"
                value={option.id}
                checked={mode === option.id}
                onChange={() => setMode(option.id)}
                className="mt-0.5 accent-[var(--color-accent)]"
              />
              <span>
                <span className="block text-sm font-medium">{option.label}</span>
                <span className="block text-xs leading-relaxed text-muted">{option.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="rounded-md border border-line px-4 py-2 text-sm font-medium text-ink transition hover:border-accent/50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Restoring…" : "Restore backup"}
        </button>
        <p aria-live="polite" className="text-xs text-muted">
          {result ? (
            <span className={result.ok ? "text-ok" : "text-bad"}>{result.text}</span>
          ) : (
            "Validated before anything is written."
          )}
        </p>
      </div>
    </form>
  );
}
