import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border border-line bg-surface p-5", className)}>
      {children}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: string;
}) {
  return (
    <div className="rounded-lg border border-line bg-surface px-4 py-3">
      <p className="text-[11px] font-medium uppercase tracking-widest text-muted">
        {label}
      </p>
      <p className={cn("mt-1 font-mono text-2xl leading-none", tone)}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

const TONES = {
  slate: "border-line bg-surface-2 text-muted",
  green: "border-ok/40 bg-ok/10 text-ok",
  amber: "border-accent/40 bg-accent/10 text-accent",
  red: "border-bad/40 bg-bad/10 text-bad",
  blue: "border-ink/20 bg-ink/5 text-ink",
} as const;

export function Badge({
  children,
  tone = "slate",
}: {
  children: ReactNode;
  tone?: keyof typeof TONES;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
        TONES[tone],
      )}
    >
      {children}
    </span>
  );
}

export function ProgressBar({
  value,
  tone,
}: {
  value: number;
  tone?: "ok" | "accent" | "bad";
}) {
  const width = Math.max(0, Math.min(100, value));
  const fill =
    tone === "ok" || (!tone && width >= 70)
      ? "bg-ok/80"
      : tone === "accent" || (!tone && width >= 40)
        ? "bg-accent/80"
        : "bg-bad/70";
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
      <div
        className={cn("h-full rounded-full transition-[width]", fill)}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-line px-5 py-10 text-center">
      <h2 className="text-sm font-semibold">{title}</h2>
      <p className="mx-auto mt-1 max-w-prose text-sm leading-relaxed text-muted">
        {description}
      </p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow ? (
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
            <span aria-hidden className="h-px w-6 bg-accent/50" />
            {eyebrow}
          </p>
        ) : null}
        <h1 className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted">
            {description}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
