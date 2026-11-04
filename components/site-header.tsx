import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { logoutAction } from "@/lib/auth/actions";
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

export async function SiteHeader() {
  const days = daysUntil(EXAM_PATTERN.examDate);
  const user = await getCurrentUser();

  const links =
    user?.role === "admin" ? [...LINKS, { href: "/admin", label: "Admin" }] : LINKS;

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
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="whitespace-nowrap rounded-md px-2.5 py-1.5 text-muted transition hover:bg-surface-2 hover:text-ink"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-3">
          <div className="hidden text-right sm:block">
            <span className="block text-xs font-medium leading-tight">
              {user?.displayName || user?.username}
            </span>
            <span className="text-[10px] uppercase tracking-widest text-muted">
              {user?.role ?? "guest"} · <span className="font-mono">{days}d</span>
            </span>
          </div>

          <form action={logoutAction}>
            <button
              type="submit"
              className="rounded-md border border-line px-2.5 py-1.5 text-xs text-muted transition hover:border-bad/50 hover:text-bad focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
