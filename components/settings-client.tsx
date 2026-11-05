"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

const INPUT =
  "w-full rounded-md border border-line bg-surface-2 px-3 py-2.5 text-sm text-ink placeholder:text-muted focus-visible:border-accent/60";

const BUTTON =
  "rounded-md border border-line px-4 py-2 text-sm text-muted transition hover:border-accent/50 hover:text-ink disabled:opacity-50";

export function SettingsClient() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [restoreMode, setRestoreMode] = useState<"merge" | "replace">("merge");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function changePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("password");
    setMessage(null);
    setError(null);
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) {
        setError(data.error || "Could not change password");
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setMessage("Password updated. Other sessions have been signed out.");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  async function downloadBackup() {
    setBusy("backup");
    setMessage(null);
    setError(null);
    try {
      const response = await fetch("/api/backup");
      if (!response.ok) throw new Error("Backup failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `jca-backup-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setMessage("Backup downloaded.");
    } catch {
      setError("Could not download backup.");
    } finally {
      setBusy(null);
    }
  }

  async function restoreBackup(file: File) {
    if (
      restoreMode === "replace" &&
      !window.confirm(
        "Replace mode deletes the attempts currently on this account before restoring. Continue?",
      )
    ) {
      if (fileRef.current) fileRef.current.value = "";
      return;
    }

    setBusy("restore");
    setMessage(null);
    setError(null);
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      const response = await fetch("/api/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, mode: restoreMode }),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
        attempts?: number;
        skipped?: number;
      };
      if (!response.ok || !data.ok) {
        setError(data.error || "Could not restore backup");
        return;
      }
      setMessage(
        `Restored ${data.attempts ?? 0} attempts${data.skipped ? ` · ${data.skipped} skipped` : ""} (${restoreMode}).`,
      );
      router.refresh();
    } catch {
      setError("Invalid backup file.");
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function resetData() {
    if (!window.confirm("Delete all your attempts, answers, and history?")) return;
    if (!window.confirm("This cannot be undone. Continue?")) return;
    setBusy("reset");
    setMessage(null);
    setError(null);
    try {
      const response = await fetch("/api/reset", { method: "POST" });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) {
        setError(data.error || "Could not reset data");
        return;
      }
      setMessage("Your attempt data was deleted.");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-xl border border-line bg-surface p-5">
        <h2 className="text-base font-semibold">Change password</h2>
        <p className="mt-1 text-sm text-muted">
          Your password is stored as a bcrypt hash. Changing it signs out every
          other session.
        </p>
        <form onSubmit={changePassword} className="mt-4 space-y-3">
          <input
            type="password"
            required
            autoComplete="current-password"
            placeholder="Current password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            className={INPUT}
          />
          <input
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            placeholder="New password (6+ characters)"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            className={INPUT}
          />
          <button
            type="submit"
            disabled={busy === "password"}
            className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-canvas transition hover:brightness-110 disabled:opacity-50"
          >
            {busy === "password" ? "Updating…" : "Update password"}
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-line bg-surface p-5">
        <h2 className="text-base font-semibold">Your data</h2>
        <p className="mt-1 text-sm text-muted">
          Attempts, answers, and history are private to your account.
        </p>

        <fieldset className="mt-4">
          <legend className="text-[11px] font-medium uppercase tracking-widest text-muted">
            Restore mode
          </legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {[
              {
                value: "merge" as const,
                title: "Merge",
                hint: "Keep current attempts and add the file's.",
              },
              {
                value: "replace" as const,
                title: "Replace",
                hint: "Delete current attempts first.",
              },
            ].map((option) => (
              <label
                key={option.value}
                className={cn(
                  "cursor-pointer rounded-lg border p-3 transition",
                  restoreMode === option.value
                    ? "border-accent/60 bg-accent/5"
                    : "border-line hover:border-muted/50",
                )}
              >
                <span className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="restoreMode"
                    value={option.value}
                    checked={restoreMode === option.value}
                    onChange={() => setRestoreMode(option.value)}
                    className="accent-[var(--color-accent)]"
                  />
                  <span className="text-sm font-medium">{option.title}</span>
                </span>
                <span className="mt-1 block pl-6 text-xs text-muted">{option.hint}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={downloadBackup}
            disabled={busy === "backup"}
            className={BUTTON}
          >
            {busy === "backup" ? "Preparing…" : "Download backup"}
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy === "restore"}
            className={BUTTON}
          >
            {busy === "restore" ? "Restoring…" : `Restore (${restoreMode})`}
          </button>
          <button
            type="button"
            onClick={resetData}
            disabled={busy === "reset"}
            className="rounded-md border border-bad/40 px-4 py-2 text-sm text-bad transition hover:bg-bad/10 disabled:opacity-50"
          >
            {busy === "reset" ? "Deleting…" : "Reset my data"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void restoreBackup(file);
            }}
          />
        </div>
      </section>

      {message ? (
        <p className="rounded-lg border border-ok/40 bg-ok/10 px-4 py-3 text-sm text-ok lg:col-span-2">
          {message}
        </p>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-bad/40 bg-bad/10 px-4 py-3 text-sm text-bad lg:col-span-2"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
