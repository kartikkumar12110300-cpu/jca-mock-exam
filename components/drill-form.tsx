"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { DRILL_COUNTS, SECTIONS } from "@/lib/exam/pattern";

const FIELD =
  "mt-1.5 w-full rounded-md border border-line bg-surface-2 px-3 py-2 text-sm text-ink focus-visible:border-accent/60";

export function DrillForm({
  sectionCounts,
  defaultSection = "",
}: {
  sectionCounts: Record<string, number>;
  defaultSection?: string;
}) {
  const router = useRouter();
  const [sectionId, setSectionId] = useState(defaultSection);
  const [count, setCount] = useState(10);
  const [order, setOrder] = useState<"weak" | "unseen" | "random">("weak");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "drill",
          ...(sectionId ? { sectionId } : {}),
          count,
          order,
        }),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
        attemptId?: string;
      };
      if (!response.ok || !data.ok || !data.attemptId) {
        setError(data.error || "Could not start the drill");
        return;
      }
      router.push(`/attempt/${data.attemptId}`);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={start} className="space-y-5">
      <div>
        <label htmlFor="section" className="text-[11px] font-medium uppercase tracking-widest text-muted">
          Section
        </label>
        <select
          id="section"
          value={sectionId}
          onChange={(event) => setSectionId(event.target.value)}
          className={FIELD}
        >
          <option value="">All sections</option>
          {SECTIONS.map((section) => (
            <option key={section.id} value={section.id}>
              {section.name} ({sectionCounts[section.id] ?? 0})
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="count" className="text-[11px] font-medium uppercase tracking-widest text-muted">
          Questions
        </label>
        <select
          id="count"
          value={count}
          onChange={(event) => setCount(Number(event.target.value))}
          className={FIELD}
        >
          {DRILL_COUNTS.map((value) => (
            <option key={value} value={value}>
              {value} questions · {value * 1.5} minutes
            </option>
          ))}
        </select>
      </div>

      <fieldset>
        <legend className="text-[11px] font-medium uppercase tracking-widest text-muted">
          Question order
        </legend>
        <div className="mt-2 grid gap-2">
          {[
            {
              value: "weak" as const,
              title: "Unseen and weak",
              hint: "Questions you have never seen, then the ones you got wrong.",
            },
            {
              value: "unseen" as const,
              title: "Never seen",
              hint: "Questions with the fewest previous attempts.",
            },
            {
              value: "random" as const,
              title: "Random mix",
              hint: "A random draw from the bank.",
            },
          ].map((option) => (
            <label
              key={option.value}
              className={`flex cursor-pointer gap-3 rounded-lg border p-3 transition ${
                order === option.value
                  ? "border-accent/60 bg-accent/5"
                  : "border-line hover:border-muted/50"
              }`}
            >
              <input
                type="radio"
                name="order"
                value={option.value}
                checked={order === option.value}
                onChange={() => setOrder(option.value)}
                className="mt-1 accent-[var(--color-accent)]"
              />
              <span>
                <span className="block text-sm font-medium">{option.title}</span>
                <span className="block text-xs text-muted">{option.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {error ? (
        <p role="alert" className="text-sm text-bad">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="rounded-md bg-accent px-5 py-2.5 text-sm font-semibold text-canvas transition hover:brightness-110 disabled:opacity-50"
      >
        {loading ? "Building drill…" : "Start drill"}
      </button>
    </form>
  );
}
