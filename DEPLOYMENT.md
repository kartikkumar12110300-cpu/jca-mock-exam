# Deploying for free — Turso + Vercel

The app is a Next.js server with a libSQL (SQLite-dialect) database. In production it
must **not** use a local file: Vercel's filesystem is ephemeral, so data would vanish on
the next deploy. Instead:

- **Database:** [Turso](https://turso.tech) — hosted libSQL. Free tier.
- **Hosting:** [Vercel Hobby](https://vercel.com) — free for personal/non-commercial use.

Total cost: **$0**. No credit card is required for either Hobby tier at the time of
writing.

---

## 0. Prerequisites

- A GitHub account with this repository pushed to it.
- A Turso account (<https://app.turso.tech> — GitHub sign-in works).
- A Vercel account (<https://vercel.com> — GitHub sign-in works).

You can do everything through the Turso web dashboard, but the CLI is quicker.

### Install the Turso CLI (optional)

```bash
# macOS / Linux
curl -sSfL https://get.tur.so/install.sh | bash

# Windows (PowerShell)
irm https://get.tur.so/install.ps1 | iex
```

Then `turso auth signup` (or `turso auth login`).

---

## 1. Create the database

```bash
turso db create jca-mock-exam
turso db show jca-mock-exam --url
turso db tokens create jca-mock-exam
```

Copy the two values:

- **URL** — looks like `libsql://jca-mock-exam-yourname.turso.io`
- **Token** — a long `eyJ…` string. Treat it as a password.

Through the dashboard instead: **Create Database** → choose a region near your users
(e.g. `aws-ap-south-1` for India) → open the database → **Connect** shows the URL, and
**Create Token** generates the auth token.

> The token is shown once. Store it somewhere safe until you paste it into Vercel.

No schema step is needed: the app runs its Drizzle migrations and seeds accounts plus
the question bank automatically on the first request.

---

## 2. Push the repository to GitHub

The project is already a git repository. If you have not created the remote yet:

```bash
gh repo create kartikkumar12110300-cpu/jca-mock-exam --private --source . --remote origin --push
```

Without the GitHub CLI: create an empty **private** repository in the GitHub UI, then

```bash
git remote add origin https://github.com/kartikkumar12110300-cpu/jca-mock-exam.git
git branch -M main
git push -u origin main
```

Never commit `.env.local`, `.env.production` or any real token. `.gitignore` already
excludes `.env*` while keeping `.env.example`.

---

## 3. Import the project into Vercel

1. Open <https://vercel.com/new>.
2. Choose **Import Git Repository** and pick the private repo (authorise Vercel for the
   `kartikkumar12110300-cpu` account if asked).
3. Framework preset: **Next.js** (detected automatically). Leave build settings alone.
4. Open **Environment Variables** and add all three:

| Name | Value | Environments |
|---|---|---|
| `TURSO_DATABASE_URL` | `libsql://…turso.io` | Production, Preview, Development |
| `TURSO_AUTH_TOKEN` | the token from step 1 | Production, Preview, Development |
| `ADMIN_PASSWORD` | a strong password you choose | Production (and Preview if you use it) |

`ADMIN_PASSWORD` is read only when the admin account is first created. If you deploy
without it, the account is `admin` / `admin` — change that before sharing the URL.
Because the app has no password-change screen, setting the variable later does **not**
update an existing admin. If you already seeded the wrong password, see
[Changing the admin password](#changing-the-admin-password) below.

5. Click **Deploy**. The first build takes a couple of minutes.

---

## 4. First boot

Open the deployment URL. The first request:

1. connects to Turso,
2. applies `drizzle/0000_polite_bug.sql` and `drizzle/0001_multi_user.sql`,
3. creates the six accounts (`user1`…`user5`, `admin`),
4. seeds the bundled question bank.

If two serverless instances start at once, one may lose the migration race; the loser
detects the existing schema and continues. This is expected and harmless.

Sign in:

- `user1` / `test1` — candidate,
- `admin` / your `ADMIN_PASSWORD` — administrator, lands on `/admin`.

Visit `/api/health` to confirm the deployment: it returns `{"ok":true,"questions":…}`.

---

## 5. Verify

Quick checks on the deployed URL:

- [ ] `/login` loads; wrong credentials show a generic error.
- [ ] `user1/test1` signs in and lands on the dashboard.
- [ ] Starting a mock, answering a few questions and submitting works.
- [ ] `user2/test2` cannot see user1's history or results.
- [ ] `admin` signs in and sees both candidates under **Monitoring**.
- [ ] The admin can open a candidate's report; there is no way to edit it.
- [ ] Sign out returns to `/login`; the back button does not resurrect the session.
- [ ] `/admin` while signed in as `user1` redirects to the dashboard.
- [ ] `/settings` as admin has backup/restore; as a candidate it does not.

---

## 6. Subsequent deploys

Push to `main`; Vercel rebuilds and deploys automatically. Preview deployments use the
same Turso database unless you create a second database and set separate Preview
variables — be aware that preview testing writes to real data.

Migrations added later run on the first request after deployment.

---

## Changing the admin password

The app intentionally has no password-change UI. Choose one of:

**A. Before the database exists (simplest).** Delete and recreate the Turso database,
set `ADMIN_PASSWORD` in Vercel, redeploy. This wipes all data.

**B. Rotate the hash in place.** Generate a new scrypt hash with the project's own
function, then update Turso:

```bash
node -e "import('./lib/auth/password.ts').then(async m => console.log(await m.hashPassword(process.argv[1])))" 'your-new-password'
```

That prints `scrypt:<salt>:<key>`. Update the row:

```bash
turso db shell jca-mock-exam
```

```sql
UPDATE users SET password_hash = 'scrypt:…' WHERE username = 'admin';
DELETE FROM sessions;   -- sign every device out
.quit
```

Option B also works for resetting a candidate's password (look up `user1`, etc.).

---

## Backups

Turso is reliable, but a free tier is not an SLA. Keep a periodic export:

1. Sign in as `admin`.
2. **Settings → Download backup**. The JSON includes accounts, questions, papers,
   attempts and answers. It contains password hashes — store it somewhere private.
3. To restore, use **Settings → Restore** (admin only). Accounts always survive a
   restore; sessions are never restored.

You can also take a database dump from the CLI:

```bash
turso db shell jca-mock-exam ".dump" > jca-dump-$(date +%F).sql
```

---

## Troubleshooting

**`/api/health` returns 500 / "URL_INVALID".**
`TURSO_DATABASE_URL` is missing or malformed. It must start with `libsql://` (or
`https://` for some regions), not `file:`.

**"Server responded with 401" in the logs.**
The auth token is wrong, expired, or belongs to another database. Create a new token
and update the Vercel variable, then redeploy.

**The app deploys but every page redirects to `/login` in a loop.**
Check the build logs for migration errors. A common cause is a missing `TURSO_AUTH_TOKEN`
while `TURSO_DATABASE_URL` is set.

**Data disappears after a deploy.**
You are still on a local file database. Confirm `TURSO_DATABASE_URL` is set for the
**Production** environment and redeploy (environment changes require a new deployment).

**"Too many failed attempts."**
The throttler allows 5 failures per username + IP per 15 minutes. Wait, or clear the
row as admin:

```sql
DELETE FROM login_attempts;
```

**Cold starts take ~1 second.**
Expected on the free tier: the serverless function and the remote database both wake up.
Subsequent requests are fast.

---

## Cost and limits (at the time of writing)

| Service | Free tier |
|---|---|
| Turso | ~5 GB storage, 500M reads/month, 100 databases |
| Vercel Hobby | 100 GB bandwidth, serverless invocation limits, non-commercial use |

Six users making a few hundred requests a day is far below both. Free tiers have no
SLA and can change; the admin JSON backup is the exit strategy. If this ever becomes
commercial, move the database to a paid Turso plan or Postgres — only the Drizzle
adapter changes.

---

## Local production smoke test (optional)

Before deploying, you can prove the production build works with a real Turso database:

```bash
# .env.local
TURSO_DATABASE_URL=libsql://…
TURSO_AUTH_TOKEN=…
ADMIN_PASSWORD=local-test-password

npm run build
npm start
```

Open <http://localhost:3000>, sign in, and run through the checklist in step 5. Delete
`.env.local` afterwards if you do not want local runs touching the hosted database.
