"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function StartMockButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "full" }),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
        attemptId?: string;
      };
      if (!response.ok || !data.ok || !data.attemptId) {
        setError(data.error || "Could not start the paper");
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
    <div className="space-y-2">
      <button
        type="button"
        onClick={start}
        disabled={loading}
        className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-canvas transition hover:brightness-110 disabled:opacity-50"
      >
        {loading ? "Building your paper…" : "Start full mock"}
      </button>
      {error ? (
        <p role="alert" className="text-xs text-bad">
          {error}
        </p>
      ) : null}
    </div>
  );
}
