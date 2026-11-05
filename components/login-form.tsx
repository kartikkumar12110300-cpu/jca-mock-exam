"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const INPUT =
  "mt-1 w-full rounded-md border border-line bg-surface-2 px-3 py-2.5 text-sm text-ink placeholder:text-muted focus-visible:border-accent/60";

export function LoginForm({ nextPath }: { nextPath?: string }) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
        user?: { role: "user" | "admin"; mustChangePassword?: boolean };
      };

      if (!response.ok || !data.ok) {
        setError(data.error || "Could not sign in");
        return;
      }

      // Seeded passwords must be replaced before the account is used.
      const target = data.user?.mustChangePassword
        ? "/settings"
        : nextPath && nextPath.startsWith("/")
          ? nextPath
          : data.user?.role === "admin"
            ? "/admin"
            : "/";
      router.replace(target);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label htmlFor="username" className="text-[11px] font-medium uppercase tracking-widest text-muted">
          Username
        </label>
        <input
          id="username"
          name="username"
          autoComplete="username"
          required
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          className={INPUT}
          placeholder="username"
        />
      </div>

      <div>
        <label htmlFor="password" className="text-[11px] font-medium uppercase tracking-widest text-muted">
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
          className={INPUT}
          placeholder="••••••"
        />
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-md border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-bad"
        >
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-canvas transition hover:brightness-110 disabled:opacity-50"
      >
        {loading ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
