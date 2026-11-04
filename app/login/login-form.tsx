"use client";

import { useState } from "react";

interface LoginResponse {
  ok: boolean;
  error?: string;
  redirectTo?: string;
}

export function LoginForm({ next }: { next?: string }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password, next }),
      });
      const data = (await response.json()) as LoginResponse;

      if (!data.ok || !data.redirectTo) {
        setError(data.error ?? "Could not sign in. Try again.");
        setPassword("");
        return;
      }

      // Full navigation so the new cookie is definitely on the request.
      window.location.assign(data.redirectTo);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not sign in. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div>
        <label
          htmlFor="username"
          className="text-[11px] font-medium uppercase tracking-widest text-muted"
        >
          Username
        </label>
        <input
          id="username"
          name="username"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          disabled={busy}
          className="mt-1.5 w-full rounded-md border border-line bg-surface-2 px-3 py-2.5 text-sm text-ink placeholder:text-muted/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60"
          placeholder="user1"
        />
      </div>

      <div>
        <label
          htmlFor="password"
          className="text-[11px] font-medium uppercase tracking-widest text-muted"
        >
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={busy}
          className="mt-1.5 w-full rounded-md border border-line bg-surface-2 px-3 py-2.5 text-sm text-ink placeholder:text-muted/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60"
          placeholder="••••••"
        />
      </div>

      {error ? (
        <p
          role="alert"
          aria-live="polite"
          className="rounded-md border border-bad/40 bg-bad/10 px-3 py-2 text-xs leading-relaxed text-bad"
        >
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={busy || !username || !password}
        className="w-full rounded-md bg-accent px-5 py-2.5 text-sm font-semibold text-canvas transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
