# JCA Mock Exam

Timed mock exams for the **Supreme Court of India — Junior Court Assistant** objective
paper (2026 cycle). Runs entirely on your own machine: one Next.js process, one SQLite
file, no accounts, no cloud.

## What it does today

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
- **Learn mode** — untimed practice in pages of 10 questions. Pick an option and it
  is marked right or wrong immediately, with the correct answer and explanation.
  Answers lock once chosen and still count towards mastery and the mistake notebook.
- **Practice drills** — 5–30 questions in 90 s each, drawn by weighted random:
  weak areas, never-seen, or a true uniform mix. Drills use the same runner, timer
  and scoring as a mock, and no two draws are the same.
- **Mistake notebook** — every question answered wrong, newest first, with the
  explanation and a one-click drill for that section.
- **Question bank** — browse by section with provenance (`manual` / `pyq` / `ai`),
  answer-key confidence (`official` / `unofficial` / `disputed`), and per-question
  history.
- **Content pipeline** — questions live in `content/*.json`; `npm run import`
  validates, deduplicates and inserts them.
- **Backup & restore** — one JSON file from Settings, merge or replace.
- **Clear practice history** — wipe every attempt, paper and answer from Settings
  while keeping the question bank, so test runs don't pollute your scores.
- **Portable build** — `npm run package` produces a zip with `Start JCA Mock.bat`,
  plus a Dockerfile for Linux/macOS/NAS.

## Quick start

```bash
npm install
npm run dev         # http://localhost:3000
```

The first boot creates `data/app.db`, applies migrations and fills the bank with
the bundled questions (20 seed + anything in `content/`). No separate seed step.

State lives in `data/app.db` (gitignored). Delete it to start fresh.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` / `npm start` | Production build |
| `npm run package` | Build the portable folder + zip in `dist/` (run after `npm run build`) |
| `npm run import -- <file\|folder>` | Import questions from JSON (`--dry-run` to preview) |
| `npm run db:seed` | Add the built-in seed questions if missing |
| `npm run db:generate` | Generate a Drizzle migration after a schema change |
| `npm run db:studio` | Browse the SQLite file |
| `npm test` | Scoring-engine unit tests |
| `npm run smoke` | End-to-end attempt lifecycle against the DB layer |
| `npm run typecheck` / `npm run lint` | Static checks |

> Stop the dev server before running `npm run build` — both write to `.next`, and a build
> during a dev session leaves the dev server serving 500s until it is restarted.

## Layout

```
app/
  page.tsx                  dashboard: stats, trend, mastery, bank coverage
  new/                      start screen + resume in-progress attempt
  attempt/[id]/             exam runner (client) + server loader
  attempt/[id]/result/      score, section table, answer review
  drill/                    drill builder + mistake preview
  mistakes/                 mistake notebook with section filters
  bank/                     question bank browser
  history/                  all attempts
  settings/                 export/restore, clear history, database counts
  api/attempts/             start · save answers · submit
  api/backup/  api/restore/ JSON backup and restore
components/
  site-header.tsx           nav + days-to-paper
lib/
  pattern.ts                THE exam definition (sections, counts, marking, dates)
  pick.ts                   weighted sampling + shuffle for composing papers
  scoring.ts                pure scoring engine (unit tested)
  attempts.ts               attempt lifecycle + DB access
  stats.ts                  history, section mastery, per-question stats
  drill.ts                  drill builder + mistake notebook queries
  import.ts                 JSON import (Zod + dedupe by content hash)
  backup.ts                 export/restore the whole database
  reset.ts                  clear practice history, keep the question bank
  db/schema.ts              Drizzle schema (questions, tests, attempts, answers)
  db/seed-data.ts           built-in seed questions
  db/index.ts               connection, migrations, first-boot seeding
content/                    importable question files + format docs
scripts/                    import · package · smoke
drizzle/                    generated migrations (run automatically on boot)
```

## Portable build

```bash
npm run build
npm run package
```

`dist/jca-mock-exam-portable.zip` contains a standalone Node server. Extract it,
double-click `Start JCA Mock.bat`, and the app opens at `http://localhost:3000`.
See `README-PORTABLE.md` for Docker and troubleshooting.

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
