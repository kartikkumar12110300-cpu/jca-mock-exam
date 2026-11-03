import Link from "next/link";
import { EXAM_PATTERN } from "@/lib/pattern";

function daysUntil(dateIso: string): number {
  const target = new Date(`${dateIso}T00:00:00+05:30`).getTime();
  return Math.ceil((target - Date.now()) / 86_400_000);
}

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/new", label: "New mock" },
  { href: "/learn", label: "Learn" },
  { href: "/drill", label: "Drill" },
  { href: "/mistakes", label: "Mistakes" },
  { href: "/history", label: "History" },
  { href: "/bank", label: "Bank" },
  { href: "/settings", label: "Settings" },
];

export function SiteHeader() {
  const days = daysUntil(EXAM_PATTERN.examDate);

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
          className="-mx-1 flex items-center gap-0.5 overflow-x-auto px-1 text-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="whitespace-nowrap rounded-md px-2.5 py-1.5 text-muted transition hover:bg-surface-2 hover:text-ink"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto shrink-0 text-right">
          <span className="font-mono text-sm text-accent">{days}</span>
          <span className="ml-1.5 hidden text-xs uppercase tracking-widest text-muted sm:inline">
            days to paper
          </span>
        </div>
      </div>
    </header>
  );
}
