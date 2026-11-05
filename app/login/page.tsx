import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { getCurrentUser } from "@/lib/auth/guards";
import { EXAM_PATTERN, SECTIONS, TOTAL_QUESTIONS } from "@/lib/exam/pattern";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) {
    redirect(
      user.mustChangePassword ? "/settings" : user.role === "admin" ? "/admin" : "/",
    );
  }

  const { next } = await searchParams;

  return (
    <main className="grid min-h-dvh bg-canvas lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden overflow-hidden border-r border-line px-12 py-14 lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(circle at 12% 18%, rgba(216,166,87,0.16), transparent 45%), radial-gradient(circle at 88% 82%, rgba(69,192,138,0.10), transparent 48%)",
          }}
        />
        <div className="relative">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-md border border-accent/40 bg-accent/10 font-mono text-sm font-semibold text-accent">
              JCA
            </span>
            <div>
              <p className="text-sm font-semibold tracking-tight">JCA Mock Exam</p>
              <p className="text-xs text-muted">
                Supreme Court of India · Junior Court Assistant
              </p>
            </div>
          </div>

          <h1 className="mt-16 max-w-lg text-4xl font-semibold leading-[1.1] tracking-tight sm:text-[2.9rem]">
            Practice the real paper.
            <span className="block text-accent">Measure what matters.</span>
          </h1>
          <p className="mt-5 max-w-md text-sm leading-6 text-muted">
            Full mocks on the 2026 pattern, learn mode without a clock, focused
            drills, a searchable question bank, and an honest record of every
            attempt.
          </p>
        </div>

        <div className="relative grid gap-4">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Questions", value: String(TOTAL_QUESTIONS) },
              { label: "Minutes", value: String(EXAM_PATTERN.durationSec / 60) },
              { label: "Sections", value: String(SECTIONS.length) },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-lg border border-line bg-surface/70 px-4 py-3 backdrop-blur"
              >
                <p className="font-mono text-2xl text-ink">{stat.value}</p>
                <p className="text-[10px] uppercase tracking-[0.16em] text-muted">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
          <p className="font-mono text-[11px] text-muted">
            Marking · +1 correct · −0.25 wrong · 0 skipped
          </p>
        </div>
      </section>

      <section className="flex items-center justify-center px-6 py-12 sm:px-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="grid size-10 place-items-center rounded-md border border-accent/40 bg-accent/10 font-mono text-sm font-semibold text-accent">
              JCA
            </span>
            <div>
              <p className="text-sm font-semibold">JCA Mock Exam</p>
              <p className="text-xs text-muted">Junior Court Assistant</p>
            </div>
          </div>

          <h2 className="text-2xl font-semibold tracking-tight">Sign in</h2>
          <p className="mt-2 text-sm text-muted">
            Use the account provided to you. There is no public registration.
          </p>

          <div className="mt-7">
            <LoginForm nextPath={next} />
          </div>

          <p className="mt-8 rounded-lg border border-line bg-surface px-4 py-3 text-xs leading-5 text-muted">
            Accounts are created by the administrator. If you cannot sign in,
            contact the administrator.
          </p>
        </div>
      </section>
    </main>
  );
}
