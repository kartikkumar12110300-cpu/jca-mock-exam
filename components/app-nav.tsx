"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { EXAM_PATTERN } from "@/lib/exam/pattern";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/new", label: "New mock" },
  { href: "/learn", label: "Learn" },
  { href: "/drill", label: "Drill" },
  { href: "/mistakes", label: "Mistakes" },
  { href: "/history", label: "History" },
  { href: "/bank", label: "Bank" },
  { href: "/settings", label: "Settings" },
];

function daysUntil(dateIso: string): number {
  const target = new Date(`${dateIso}T00:00:00+05:30`).getTime();
  return Math.ceil((target - Date.now()) / 86_400_000);
}

export function AppNav({
  displayName,
  username,
  role,
}: {
  displayName: string;
  username: string;
  role: "user" | "admin";
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const days = daysUntil(EXAM_PATTERN.examDate);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  async function logout() {
    setLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-canvas/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2.5 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
        >
          <span className="grid size-8 place-items-center rounded-md border border-accent/40 bg-accent/10 font-mono text-[11px] font-semibold text-accent">
            JCA
          </span>
          <span className="hidden text-sm font-semibold sm:inline">Mock Exam</span>
        </Link>

        <nav
          aria-label="Main"
          className="-mx-1 hidden items-center gap-0.5 px-1 text-sm lg:flex"
        >
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive(link.href) ? "page" : undefined}
              className={cn(
                "whitespace-nowrap rounded-md px-2.5 py-1.5 transition",
                isActive(link.href)
                  ? "bg-surface-2 text-ink"
                  : "text-muted hover:bg-surface-2 hover:text-ink",
              )}
            >
              {link.label}
            </Link>
          ))}
          {role === "admin" ? (
            <Link
              href="/admin"
              aria-current={isActive("/admin") ? "page" : undefined}
              className={cn(
                "whitespace-nowrap rounded-md border px-2.5 py-1.5 transition",
                isActive("/admin")
                  ? "border-accent/60 bg-accent/10 text-accent"
                  : "border-line text-accent/90 hover:border-accent/50 hover:text-accent",
              )}
            >
              Admin
            </Link>
          ) : null}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <div className="hidden text-right sm:block">
            <span className="font-mono text-sm text-accent">{Math.max(0, days)}</span>
            <span className="ml-1.5 text-[10px] uppercase tracking-widest text-muted">
              days to paper
            </span>
          </div>

          <div className="hidden text-right md:block">
            <p className="max-w-[10rem] truncate text-xs font-medium text-ink">
              {displayName}
            </p>
            <p className="text-[10px] text-muted">@{username}</p>
          </div>

          <button
            type="button"
            onClick={logout}
            disabled={loggingOut}
            className="hidden rounded-md border border-line px-2.5 py-1.5 text-xs text-muted transition hover:border-accent/50 hover:text-ink disabled:opacity-50 sm:block"
          >
            {loggingOut ? "Leaving…" : "Log out"}
          </button>

          <button
            type="button"
            aria-label="Toggle navigation"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
            className="rounded-md border border-line px-2.5 py-1.5 text-xs text-muted transition hover:text-ink lg:hidden"
          >
            {open ? "Close" : "Menu"}
          </button>
        </div>
      </div>

      {open ? (
        <nav
          aria-label="Mobile"
          className="border-t border-line px-4 py-3 lg:hidden"
        >
          <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-widest text-muted">
            <span>@{username}</span>
            <span className="font-mono normal-case tracking-normal text-accent">
              {Math.max(0, days)} days to paper
            </span>
          </div>
          <div className="grid gap-1 sm:grid-cols-2">
            {[...links, ...(role === "admin" ? [{ href: "/admin", label: "Admin" }] : [])].map(
              (link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  aria-current={isActive(link.href) ? "page" : undefined}
                  className={cn(
                    "rounded-md px-3 py-2 text-sm transition",
                    isActive(link.href)
                      ? "bg-surface-2 text-ink"
                      : "text-muted hover:bg-surface-2 hover:text-ink",
                  )}
                >
                  {link.label}
                </Link>
              ),
            )}
          </div>
          <button
            type="button"
            onClick={logout}
            disabled={loggingOut}
            className="mt-2 w-full rounded-md border border-line px-3 py-2 text-sm text-muted transition hover:border-accent/50 hover:text-ink disabled:opacity-50"
          >
            {loggingOut ? "Leaving…" : "Log out"}
          </button>
        </nav>
      ) : null}
    </header>
  );
}
