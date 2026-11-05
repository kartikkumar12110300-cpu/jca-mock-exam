# JCA Mock Exam

A private, multi-user mock-exam platform for the Supreme Court of India **Junior Court Assistant (JCA)** paper. It runs on Next.js with MongoDB, supports credential login for five candidates plus an administrator, and gives the administrator a performance dashboard across every account.

**Live:** <https://jca-mock-exam.onrender.com>

> The Render free instance sleeps after inactivity, so the first request after a quiet period can take up to a minute.

## What it does

- **Full mocks** use the 2026 pattern: 100 questions across 7 sections in 90 minutes.
- **Learn mode:** 10-question pages with no clock; each answer is marked immediately, the key and explanation are revealed, and the choice locks so it is a rep rather than a guess. Sessions resume for 30 days.
- **Marking:** +1 correct, −0.25 wrong, 0 skipped, +1 for bonus questions. Pass mark 50, target 78. Short papers use proportionally scaled pass and target marks.
- **Fresh papers:** each attempt is assembled from the bank, preferring unseen questions, then previously wrong ones, then the rest.
- **Drills:** 5–30 questions from one section or all sections, with the same marking.
- **Question bank:** searchable and filterable by section and topic, with answers and explanations.
- **Mistake notebook:** every wrong answer, newest first, with the correct option and explanation.
- **History and results:** per-section breakdown, net marks, verdict against the scaled targets, and full question review.
- **Private data:** candidates only ever read and write their own attempts. No public registration.
- **Admin dashboard:** candidate list, per-candidate attempts, section accuracy, full-mock pass rate, recent submissions, and the most-missed questions. Admins cannot see or reset passwords.
- **Backup / restore / reset:** each candidate can export and restore their own attempt data, in merge or replace mode.

## Tech stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 15 (App Router) + React 19 |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS 4 |
| Database | MongoDB (official driver) |
| Auth | Signed JWT in an HttpOnly cookie (`jose`) |
| Passwords | bcrypt (`bcryptjs`) |
| Validation | Zod |
| Tests | Vitest |

## Seeded accounts

Seeding is idempotent and reads every credential from the environment. The
repository no longer publishes account passwords.

- `ADMIN_USERNAME` / `ADMIN_PASSWORD` create the administrator.
- `SEED_USER_PASSWORDS` is a comma-separated list for `user1`..`user5`.

Seeded accounts are flagged `mustChangePassword`. After signing in, they land on
**Settings** with a banner until they set a personal password. Changing a
password bumps `tokenVersion`, which signs out every older session. Existing
accounts are left alone unless `SEED_FORCE_PASSWORD=true` is set; a forced reset
also bumps `tokenVersion` and re-flags the account. There is no self-service
registration and no administrator password-reset feature.

## Local setup

Requirements: Node.js 22+ and a MongoDB connection string (Atlas or self-hosted).

```bash
npm install
cp .env.example .env
# fill MONGODB_URI and AUTH_SECRET, keep or change the seeded passwords
npm run db:seed     # creates indexes, accounts, and the question bank
npm run dev
```

Open <http://localhost:3000>.

### Environment

| Key | Required | Purpose |
| --- | --- | --- |
| `MONGODB_URI` | yes | MongoDB connection string |
| `MONGODB_DB` | yes | Database name (`jca-mock-exam`) |
| `AUTH_SECRET` | yes | Signs session cookies; at least 32 characters |
| `ADMIN_USERNAME` | yes | Seeded admin username |
| `ADMIN_PASSWORD` | yes | Seeded admin password |
| `SEED_USER_PASSWORDS` | yes | Comma-separated passwords for `user1`..`user5` |
| `COOKIE_SECURE` | no | `true` on HTTPS, `false` only for local HTTP testing |
Never commit `.env`. It is gitignored.

## Project structure

```text
app/
  (app)/                authenticated shell: dashboard, new, drill, bank,
                        mistakes, history, learn, settings, admin
  attempt/[id]/         distraction-free exam runner
  result/[id]/          score, section breakdown, full question review
  login/                credential login
  api/                  auth, attempts, admin, backup, health
components/             nav, forms, attempt runner, shared UI
lib/
  admin/                aggregate and per-user analytics
  auth/                 password hashing, JWT sessions, guards, rate limiting
  db/                   Mongo client, collections, indexes, types
  exam/                 pattern, scoring, selection, attempt service, queries
  validation/           Zod schemas
  backup.ts             export, restore, reset
content/                question bank (9 papers, 665 questions)
scripts/                seed and index setup
tests/                  Vitest unit tests
render.yaml             Render Blueprint
```

## Core logic

### Exam pattern

| Section | Questions |
| --- | ---: |
| English | 20 |
| Aptitude | 15 |
| GK | 15 |
| Constitution | 15 |
| SC Rules 2013 | 10 |
| Rules 1961 | 10 |
| Computer | 15 |
| **Total** | **100** |

### Attempt lifecycle

1. A test and an `in_progress` attempt are created together.
2. Answers autosave individually with selected option, review flag, and time spent.
3. Submitting — or the timer expiring — scores the attempt and stores a snapshot.
4. Results expose per-section totals, a verdict against scaled pass/target marks, and explanations.

### Learn mode

- A learn session is a normal attempt with `kind: "learn"`, no clock, and a
  30-day resume window.
- The answer key is sent to the client as soon as the session starts. To stop a
  learner from revealing the key and then changing their mind, the first choice
  for a question is final; later writes return `409` with reason `locked`.
- Ten questions a page, up to 50 a session. Answers still feed section mastery
  and the mistake notebook.
- Finishing early submits the session; unanswered questions are skipped.

### Backup and restore

- A backup is a JSON file with tests, attempts, and answers.
- **Merge** (default) keeps existing attempts and adds the file's, skipping
  duplicates by paper title + creation time (±1s).
- **Replace** deletes the account's current attempts before importing.
- The file is untrusted. Restore re-marks every answer against the question
  bank and re-scores every submitted paper on the server, so a hand-edited
  backup cannot inflate a candidate's record or the admin dashboard.

### Access control

Every page and API checks the session server-side.

- Users can only read and write their own attempts, answers, history, and mistakes.
- Admins can read aggregate and per-user performance, but never passwords.
- There is no registration endpoint. Only seeded accounts exist.
- Login is rate-limited: 5 failures per IP + username and a separate per-IP cap, both for 15 minutes.
- Sessions carry a `tokenVersion`. A password change invalidates every older session.
- Admin pass rate and average are computed from full mocks only; short drills are not counted as failures.

### Interface

A single dark theme is defined as Tailwind 4 `@theme` tokens in
`app/globals.css` (canvas, surface, line, ink, muted, accent, ok, bad) with Geist
Sans and Geist Mono. A sticky header shows the countdown to the exam date, and
the exam runner keeps its clock and question palette fixed while scrolling.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm start` | Run the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check |
| `npm test` | Vitest unit tests |
| `npm run db:indexes` | Create MongoDB indexes |
| `npm run db:seed` | Seed accounts and question bank (local `.env`) |
| `npm run start:render` | Seed idempotently, then start (used by Render) |

## Tests

Unit tests cover the exam pattern and scaled verdicts, marking and section totals, question selection, session tokens, password hashing, learn-mode limits, and backup/restore validation. See [TESTS.md](./TESTS.md) for the full checklist and the integration checks performed against the live database.

```bash
npm test
```

## Deploy on Render

**Deployed:** <https://jca-mock-exam.onrender.com> (Blueprint from `render.yaml`).

A Render Blueprint is included in [`render.yaml`](./render.yaml).

1. Create a **New Blueprint Instance** on Render and connect this GitHub repository.
2. Set the secret environment variables when prompted:
   - `MONGODB_URI` — the Atlas connection string
   - `ADMIN_USERNAME` and `ADMIN_PASSWORD` — the administrator account
   - `SEED_USER_PASSWORDS` — comma-separated passwords for the candidate accounts
3. Render generates `AUTH_SECRET`, builds with `npm ci && npm run build`, then runs `npm run start:render`.
4. The start command seeds indexes, the six accounts, and the question bank idempotently before `next start`.
5. Atlas must allow Render's outbound IPs. For a small private deployment, an Atlas IP access-list entry of `0.0.0.0/0` is the simplest option.

The health check is `GET /api/health`. Sessions use `Secure` cookies when `COOKIE_SECURE=true`.
