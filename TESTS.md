# Test checklist

Last local run: 2026-11-18. Unit suite: **43 passed / 43** across 8 files.
`npm run typecheck`, `npm run lint` and `npm run build` also pass.
The integration and live-deployment checks below were performed on 2026-11-03/04 and
remain recorded as historical verification.

## Unit (`npm test`)

### Exam pattern — `tests/pattern.test.ts`

- [x] A full paper has 100 questions across 7 sections
- [x] Section ids and names are unique
- [x] Section quotas match the published pattern (20/15/15/15/10/10/15)
- [x] Clock is 90 minutes and marking is +1 / −0.25 / 0 / +1 bonus
- [x] Pass mark 50, target 78
- [x] Drill sizes are 5, 10, 15, 20, 30
- [x] Section names resolve; unknown ids fall through safely

### Scoring — `tests/scoring.test.ts`

- [x] Correct answer scores +1
- [x] Wrong answer scores −0.25
- [x] Skipped answer scores 0
- [x] Bonus question scores +1 regardless of choice
- [x] Correct + wrong + skipped + bonus combine into the total
- [x] Per-section net marks sum to the overall total
- [x] Empty answer set returns zeros

### Selection — `tests/selection.test.ts`

- [x] Unseen questions are preferred in `unseen` mode
- [x] Wrong answers rank ahead of correct ones in `weak` mode
- [x] Unseen questions rank ahead of previously seen ones in `weak` mode
- [x] Requested count is capped
- [x] Count greater than the pool returns the whole pool without duplicates
- [x] Zero or negative count returns nothing
- [x] Full-pattern selection respects each section quota

### Auth — `tests/auth-token.test.ts`, `tests/password.test.ts`

- [x] Session token round-trips a user payload
- [x] Missing token is rejected
- [x] Tampered token is rejected
- [x] Token signed with a different secret is rejected
- [x] bcrypt hash verifies the original password
- [x] Wrong password is rejected
- [x] The same password produces different hashes (salted)

### Backup — `tests/backup-schema.test.ts`

- [x] Valid backup payload is accepted
- [x] Unsupported version is rejected
- [x] Selected option outside 0–3 is rejected
- [x] Missing `exportedAt` is rejected

## Integration (live MongoDB + production server)

Verified against the seeded Atlas database on 2026-11-03.

- [x] `npm run db:seed` is idempotent: second run creates 0 accounts and inserts 0 questions
- [x] Six accounts exist (`admin`, `user1`..`user5`)
- [x] Question bank has 665 published questions across 7 sections
- [x] `GET /api/health` returns `ok: true` and the published count
- [x] Login succeeds with valid credentials
- [x] Login fails with invalid credentials (401)
- [x] Login is rate-limited after repeated failures (401 × 5, then 429)
- [x] A candidate creates a full mock with exactly 100 questions
- [x] Autosaved answer survives a re-fetch (selected option and review flag)
- [x] Submitting returns a score and marks the attempt `submitted`
- [x] An expired attempt auto-submits on read, with a stored `submittedAt`
- [x] Submitted attempts reveal correct answers and explanations
- [x] Section breakdown contains 7 sections
- [x] User2 receives 404 when reading user1's attempt
- [x] Non-admin receives 403 on admin API endpoints
- [x] Admin overview returns users, attempts, average, pass rate, sections, and recent submissions
- [x] Admin user list shows per-candidate attempts and averages
- [x] Admin per-user performance returns attempts, sections, and most-missed questions
- [x] A candidate can change their own password and sign in with the new one
- [x] A candidate can export a backup, reset their data, and restore the backup
- [x] A candidate can reset their own attempt data
- [x] Resetting test data leaves zero submitted and zero in-progress attempts

## Page render checks (production server)

Each route was fetched with an authenticated session and returned HTTP 200:

- [x] `/` dashboard
- [x] `/new`, `/drill`, `/bank` (with filters), `/mistakes`, `/history`, `/learn`, `/settings`
- [x] `/result/[id]` for a submitted attempt
- [x] `/admin`, `/admin/users`, `/admin/users/[id]` as admin
- [x] `/attempt/[id]` for a submitted attempt redirects to its result (307)
- [x] `/admin` as a non-admin redirects away (307)

## Live deployment

Verified on <https://jca-mock-exam.onrender.com> on 2026-11-04:

- [x] `GET /api/health` returns `ok: true`, 665 published questions
- [x] Login page and compiled CSS load over HTTPS
- [x] Admin login (`admin` / `admin`) works; admin overview and user list render
- [x] Six accounts are seeded: `admin`, `user1`..`user5`
- [x] Candidate login (`user1` / `test1`) works
- [x] A full mock is created with 100 questions across 7 sections
- [x] An answer autosaves
- [x] Submission stores a score and marks the attempt submitted
- [x] The result page renders the full question review
- [x] Admin overview sees the candidate's new submission
- [x] Candidate reset removes the test attempt; admin overview returns to zero
- [x] User1 gets 404 reading user2's attempt
- [x] Non-admin gets 403 on admin API endpoints
- [x] Test data was cleaned up after verification

## Manual browser checks still recommended after deployment

These need a real browser and are listed so they are not forgotten:

- [ ] Timer counts down and turns urgent under 5 minutes
- [ ] Palette navigation, mark-for-review, and clear answer work by click
- [ ] Keyboard shortcuts A–D and ← → work
- [ ] Reloading mid-attempt restores answers and the remaining clock
- [ ] The client clock triggers auto-submit at zero (server-side expiry is verified)
- [ ] Mobile navigation and palette open and close correctly
- [ ] Screen reader labels and focus order on login and exam runner

## Commands

```bash
npm test
npm run typecheck
npm run lint
npm run build
```
