import Link from "next/link";
import { SiteHeader } from "@/components/site-header";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <div className="mx-auto max-w-3xl px-6 py-20 text-center">
        <p className="font-mono text-xs uppercase tracking-widest text-accent">404</p>
        <h1 className="mt-3 text-2xl font-semibold">Nothing here</h1>
        <p className="mt-2 text-sm text-muted">
          That paper or page does not exist. It may have been deleted, or the link is
          wrong.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link
            href="/"
            className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-canvas transition hover:brightness-110"
          >
            Back to dashboard
          </Link>
          <Link
            href="/new"
            className="rounded-md border border-line px-4 py-2 text-sm text-muted transition hover:text-ink"
          >
            Start a mock
          </Link>
        </div>
      </div>
    </>
  );
}
