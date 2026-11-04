# JCA Mock Exam

Timed mock exams for the **Supreme Court of India — Junior Court Assistant** objective
paper (2026 cycle), now with **accounts, private practice history and a read-only admin
dashboard**. It runs on Next.js + SQLite (libSQL): a local file for development, or
**Turso** in the cloud. Hosting on **Vercel Hobby** is free.

## What it does

- **Full mock** in the real 2026 pattern — 100 questions, 7 sections, 90 minutes,
  `+1 / −0.25`, auto-submit at zero. Every paper is composed fresh from the bank:
  unseen questions first, then ones you answered wrong, with a random draw so no
  two papers repeat.
- **Exam runner** — question palette, mark-for-review, keyboard shortcuts
  (`1–4`/`A–D`, `←/→`, `M`, `S`), continuous autosave, crash-safe resume.
- **Server-side scoring** — the client never computes or submits a score.
- **Results** — net score, per-section table against the study-plan targets,
  accuracy, and a full answer review with explanations.
- **Dashboard & history** — attempts, best/last/average net, score trend, section
  mastery (weakest first), and bank coverage.
- **Learn mode** — untimed practice in pages of 10 questions with instant feedback.
- **Practice drills** — 5–30 questions in 90 s each, drawn by weighted random:
  weak areas, never-seen, or a true uniform mix.
- **Mistake notebook** — every question answered wrong, newest first, with the
  explanation and a one-click drill for that section.
- **Question bank** — browse by section with provenance and per-question history.
- **Content pipeline** — questions live in `content/*.json`; `npm run import`
  validates, deduplicates and inserts them.
- **Multi-user accounts** — five seeded candidates plus one administrator; no public
  registration and no user-creation UI.
- **Private data** — a user can only read or write their own attempts. The admin sees
  aggregate reports and completed papers, read-only.
- **Backup & restore** — one JSON file from Settings. Admin only.
- **Clear my history** — each user can wipe their own attempts while the shared question
  bank survives.
- **Portable build** — `npm run package` produces a zip with `Start JCA Mock.bat`,
  plus a Dockerfile for Linux/macOS/NAS.

## Accounts

Accounts are created on the **first boot** from a fixed list:

| Username | Password | Role |
|---|---|---|
| `user1` … `user5` | `test1` … `test5` | candidate |
| `admin` | `admin` (or `ADMIN_PASSWORD`) | administrator |

There is deliberately no sign-up page and no user-creation screen. To add or remove an
account, edit `lib/auth/seed.ts` (for a fresh database) or manage the `users` table
directly. Passwords are stored as scrypt hashes, never plaintext.

> **Before deploying, set `ADMIN_PASSWORD`.** It is read only when the admin account is
> first created, so changing it later does not reset an existing password. If you seed a
> fresh production database with `admin/admin`, sign in and replace the account before
> sharing the URL — the app has no password-change UI, so this is a database change.

## Quick start (local)

```bash
npm install
copy .env.example .env.local   # Windows; or: cp .env.example .env.local
npm run dev                    # http://localhost:3000
```

The first boot creates `data/app.db`, applies migrations and fills the bank with the
bundled questions. No separate seed step. Sign in with `user1/test1` (candidate) or
`admin/admin` (administrator).

State lives in `data/app.db` (gitignored). Delete it to start completely fresh.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` / `npm start` | Production build |
| `npm run package` | Build the portable folder + zip in `dist/` (run after `npm run build`) |
| `npm run import -- <file\|folder>` | Import questions from JSON (`--dry-run` to preview) |
| `npm run db:seed` | Add the built-in seed questions if missing |
| `npm run db:generate` | Generate a Drizzle migration after a schema change |
| `npm run db:studio` | Browse the local SQLite file |
| `npm test` | Unit + integration tests (auth, isolation, admin, scoring) |
| `npm run smoke` | End-to-end attempt lifecycle against the DB layer |
| `npm run typecheck` / `npm run lint` | Static checks |

> Stop the dev server before running `npm run build` — both write to `.next`, and a build
> during a dev session leaves the dev server serving 500s until it is restarted.

## Layout

```
app/
  login/                    sign-in page (public)
  (app)/                    guarded candidate pages
    page.tsx                dashboard
    new/                    start screen + resume in-progress attempt
    attempt/[id]/           exam runner (client) + server loader
    attempt/[id]/result/    score, section table, answer review
    drill/  learn/          practice modes
    mistakes/  bank/        mistake notebook and question bank browser
    history/  settings/     attempt history, data controls
  admin/                    guarded monitoring dashboard (admin only)
    page.tsx                all accounts overview
    users/[id]/             one candidate's report
  api/auth/                 login · logout
  api/attempts/             start · save answers · submit (owner scoped)
  api/backup/  api/restore/ JSON backup and restore (admin only)
  api/reset/  api/health/   clear own history · database health
components/
  site-header.tsx           nav, current user, sign out
lib/
  auth/                     password (scrypt) · sessions · rate limit · guards
  pattern.ts                THE exam definition (sections, counts, marking, dates)
  pick.ts  scoring.ts       weighted sampling + pure scoring engine
  attempts.ts               attempt lifecycle, ownership checks
  stats.ts  admin.ts        per-user stats + read-only admin aggregation
  drill.ts  learn.ts        practice builders
  import.ts                 JSON import (Zod + dedupe by content hash)
  backup.ts                 export/restore the whole database (v2, includes users)
  reset.ts                  clear one user's practice history
  db/schema.ts              Drizzle schema (users, sessions, attempts, …)
  db/index.ts               libSQL connection, migrations, first-boot seeding
content/                    importable question files + format docs
scripts/                    import · package · smoke
tests/                      auth, isolation, admin and token tests
drizzle/                    migrations (run automatically on boot)
```

## Data and privacy

- Every attempt has a `user_id`. The data layer **never** exposes an unscoped reader:
  `listAttempts(userId)`, `getMistakes(userId)`, `getAttemptBundle(id, viewer)` and
  friends all check ownership. Hiding a link is never treated as security.
- An admin can read another user's submitted paper and reports, but `saveAnswers` and
  `submitAttempt` only accept the owner. The admin UI has no write controls.
- Sessions are random 256-bit tokens in an `httpOnly`, `SameSite=Lax` cookie. The
  database stores only the sha256, so a database dump does not grant live logins.
- Login failures are throttled per `username|ip`: 5 failures in 15 minutes. The counter
  lives in the database because serverless instances do not share memory.
- Backups contain password hashes (needed to restore logins) and are admin-only.
  Treat the JSON file as sensitive.
- `TURSO_AUTH_TOKEN` and `ADMIN_PASSWORD` are never committed. `.env*` is gitignored
  except `.env.example`.

## Deployment (free)

Turso + Vercel Hobby, $0. Full step-by-step instructions, including creating the
database and setting environment variables, are in **[DEPLOYMENT.md](./DEPLOYMENT.md)**.

At a glance:

```bash
# once, on your machine
turso db create jca-mock-exam
turso db show jca-mock-exam --url
turso db tokens create jca-mock-exam
```

Set these in Vercel → Project → Settings → Environment Variables, then deploy:

| Name | Value |
|---|---|
| `TURSO_DATABASE_URL` | `libsql://…turso.io` |
| `TURSO_AUTH_TOKEN` | the token from `turso db tokens create` |
| `ADMIN_PASSWORD` | a strong password, **before the first boot** |

Migrations and account/question seeding run automatically on the first request.

Free-tier caveat: no SLA, ~1 s cold starts, and pricing can change. For a personal exam
app that is acceptable; keep the admin JSON backup as the escape hatch.

## Testing

`npm test` covers password hashing, session-token hashing, ownership isolation,
login throttling, stat scoping and admin aggregation against a temporary database.
The manual QA checklist (login, roles, private data, reset, backup/restore) is
**[TESTS.md](./TESTS.md)**.

## Rules baked into the engine

- 100 questions / 90 minutes / 7 sections: English 20, Aptitude 15, GK 15,
  Constitution 15, SC Rules 2013 10, Rules 1961 10, Computer 15.
- `+1` correct, `−0.25` wrong, `0` skipped.
- **Bonus questions** score `+1` even when unattempted (the 2025 revised key
  precedent) and are excluded from accuracy.
- **Paper composition** — each full mock draws a weighted sample per section
  (unseen first, then wrong answers, recently-served deprioritised) and shuffles
  within each section. A section with fewer questions than its quota uses all of
  them; a question is never repeated inside one paper.
- Every paper stores its **own pattern snapshot**, so legacy 125-question papers
  stay playable as-is.
- Timer derives from an `endsAt` timestamp and re-syncs on refocus; answers are
  accepted for 15 s after the bell, then the attempt is marked expired.
- Pass mark 50, target 78, exam date 2026-11-20 — all in `lib/pattern.ts`.

## Roadmap

| Phase | Status |
|---|---|
| 0 — Scaffold, schema, pattern config, seed bank | done |
| 1 — Exam runner, autosave, scoring | done |
| 2 — Results + solution review | done |
| 3 — Dashboard, attempt history, score trend | done |
| 4 — Mistake notebook + weak-area drill | done |
| 5 — Question bank UI + JSON import pipeline | done |
| 6 — AI generation + review queue | not started |
| 7 — Portable packaging (zip + Docker), backup/restore | done |
| 8 — Multi-user auth, admin monitoring, Turso/Vercel | done |
