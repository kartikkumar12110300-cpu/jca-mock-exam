# Test checklist

Two layers: automated tests (`npm test`) and a manual end-to-end pass that covers the
parts a unit test cannot (cookies, redirects, UI, Vercel). Run the automated layer on
every change; run the manual layer before publishing a build.

## Automated

```bash
npm run typecheck
npm run lint
npm test
npm run smoke
```

`npm test` uses a fresh temporary libSQL file per test file (`tests/helpers/test-db.ts`),
applies the real migrations and seeds the real accounts. It never touches `data/app.db`.

| File | Covers |
|---|---|
| `tests/password.test.ts` | scrypt round-trip, wrong password, unique salts, malformed hashes, no plaintext, dummy timing hash |
| `tests/token.test.ts` | unique session tokens, deterministic sha256, raw token never stored |
| `tests/isolation.test.ts` | seeded accounts and roles, owner/member/admin read rules, autosave denied for non-owners *and* admins, submit only by owner, idempotent submit, per-user attempt lists, per-user mastery, clear-history isolation, login throttle limit/reset/key separation |
| `tests/admin.test.ts` | overview totals, inactive accounts, per-user detail, mastery/trend/kind breakdown, mistake count, unknown id |
| `lib/scoring.test.ts`, `lib/pick.test.ts`, `lib/selection.test.ts` | existing scoring and selection engine tests |

Expected: **7 files, 48 tests passing**.

`npm run smoke` exercises a full attempt against the DB layer and also asserts that an
admin can read the paper but cannot write to it.

## Manual — local

Start with `npm run dev` and a clean database (`data/app.db` deleted).

### Login and sessions

- [ ] `/` while signed out redirects to `/login`.
- [ ] Any candidate page while signed out redirects to `/login`.
- [ ] `/admin` while signed out redirects to `/login`.
- [ ] `user1` / wrong password shows a generic error and clears the password field.
- [ ] Wrong username and wrong password produce the same message.
- [ ] `user1` / `test1` signs in and lands on the dashboard.
- [ ] `admin` / `admin` signs in and lands on `/admin`.
- [ ] After signing in, `/login` redirects away to the right home.
- [ ] Sign out returns to `/login`; the back button does not restore the session.
- [ ] A manually edited `jca_session` cookie does not authenticate.
- [ ] Restart the dev server; the session still works (it is in the database).

### Throttling

- [ ] Five wrong passwords for `user1` show the first four as invalid credentials and
  the fifth/next attempt as "too many failed attempts".
- [ ] A different username is not blocked by the same IP.
- [ ] Signing in successfully before the limit clears the counter.

### Candidate isolation

Sign in as `user1`, start and submit a mock. Then sign in as `user2`.

- [ ] `user2`'s dashboard shows no attempts for user1.
- [ ] `/history` as user2 does not list user1's attempt.
- [ ] `/mistakes` as user2 does not show user1's wrong answers.
- [ ] Opening user1's `/attempt/<id>/result` URL as user2 gives 404.
- [ ] Opening user1's `/attempt/<id>` (in progress) as user2 gives 404.
- [ ] `PATCH /api/attempts/<user1-id>/answers` as user2 returns 404 and writes nothing.
- [ ] `POST /api/attempts/<user1-id>/submit` as user2 returns 404.
- [ ] `POST /api/backup` as user2 returns 401/405; `GET /api/backup` returns 403.
- [ ] `POST /api/restore` as user2 returns 403.
- [ ] `POST /api/reset` as user2 clears only user2's history.

### Admin monitoring

Sign in as `admin`.

- [ ] `/admin` lists all six accounts with attempt/score columns.
- [ ] `user1` shows the submitted attempt and a best/average/latest score.
- [ ] `user2` shows zeros/dashes, not user1's data.
- [ ] Opening a candidate's report shows section mastery, recent trend and attempts.
- [ ] Reviewing a candidate's completed paper works.
- [ ] There is **no** control to edit a score, submit for a candidate, resume their
  paper, create a user or impersonate them.
- [ ] Admin's own dashboard shows the admin's own (empty) practice data, not everyone's.

### Exam flow regression

- [ ] Start a full mock: 100 questions, sections in the right order, 90-minute clock.
- [ ] Answer, mark for review, use keyboard shortcuts; reload the page mid-attempt and
  confirm answers/timer resume.
- [ ] Autosave survives a brief network drop (answers persist after refresh).
- [ ] Submitting shows the result page with net score, section table and review.
- [ ] Drills and Learn mode still work and report errors with a helpful message.
- [ ] Section filters on Bank/Mistakes/Drill work.

### Settings and data

As a candidate:

- [ ] Settings shows **My papers / My attempts**, not global counts.
- [ ] No backup or restore section is visible.
- [ ] "Clear my practice history" deletes only this account's attempts.
- [ ] The question bank still has the same number of questions afterwards.
- [ ] Another account's history is untouched.

As admin:

- [ ] Backup and restore sections are visible.
- [ ] Download backup produces JSON with `"format": "jca-mock-exam-backup"`,
  `"version": 2`, and a `users` array.
- [ ] Restore in `merge` mode twice does not duplicate rows.
- [ ] Restore never deletes the current admin account or signs the admin out.
- [ ] Restoring a v1 backup (no `users`) assigns legacy attempts to the current admin.

## Manual — production (Vercel + Turso)

Repeat the login, isolation, admin and exam-flow sections on the deployed URL.

- [ ] `/api/health` returns `ok: true` and a non-zero question count.
- [ ] The database URL in `/api/health` is the Turso host, not `file:`.
- [ ] A first-boot deployment seeds exactly six accounts and one bank.
- [ ] Deploying again does not duplicate accounts or questions.
- [ ] A submitted attempt survives a redeploy (data is in Turso, not the function).
- [ ] Cold start is acceptable (~1 s).
- [ ] `ADMIN_PASSWORD` from Vercel was used for the seeded admin, not `admin`.
- [ ] The admin download/restore still works against Turso.

## Known gaps

- No automated browser test for the cookie/redirect flow (covered manually above).
- No password-change screen; changing the admin password is a database operation
  described in `DEPLOYMENT.md`.
- No account-creation UI, by design.
- Expired sessions are rejected but only cleaned up opportunistically.

## Sign-off

| Check | Result | Date |
|---|---|---|
| typecheck | pass | 2026-11-04 |
| lint | pass | 2026-11-04 |
| tests | pass — 7 files, 48 tests | 2026-11-04 |
| smoke | pass | 2026-11-04 |
| production build (`npm run build`) | pass | 2026-11-04 |
| portable package boot | pass | 2026-11-04 |
| local manual pass | pass — 49 HTTP checks | 2026-11-04 |
| production manual pass | pending deploy | |
