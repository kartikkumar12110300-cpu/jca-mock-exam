# JCA Mock Exam — portable edition

A self-contained copy of the app. No installation, no internet connection, no external
database. Accounts are stored in the local file, so each candidate's history stays private
to their login.

## Windows: double-click

1. Extract the whole folder somewhere you can write to (e.g. `Documents\JCA Mock Exam`).
2. Double-click **`Start JCA Mock.bat`**.
3. Your browser opens at <http://localhost:3000>.
4. Sign in with one of the accounts below.
5. Close the black window to stop the app.

The first run creates `data\app.db`, applies the schema and fills it with the bundled
question bank.

> Keep the folder together. `server.js`, `.next\`, `node_modules\`, `drizzle\`
> and `content\` are all needed. `data\` is the only folder that changes.

## Accounts

| Username | Password | Role |
|---|---|---|
| `user1` … `user5` | `test1` … `test5` | candidate |
| `admin` | `admin` | administrator |

There is no sign-up screen. Accounts are created automatically on the **first run**.
The admin password can be changed before the first run by uncommenting the
`set ADMIN_PASSWORD=...` line in `Start JCA Mock.bat` (or exporting the variable before
running `node server.js`):

```bat
set ADMIN_PASSWORD=choose-something-strong
```

Setting it after the database exists has no effect. To start over with a new password,
close the app, delete `data\app.db` and start again (this erases all attempts).

## Your data

Everything — accounts, questions, papers, attempts, answers — lives in **`data\app.db`**.
Nothing is sent anywhere. Each candidate only sees their own dashboard, history and
mistakes; the admin can view everyone's reports read-only.

- **Back up (admin):** open **Settings** in the app and click *Download backup*. The JSON
  contains password hashes, so keep it private.
- **Move machines (admin):** copy the folder, then restore the backup from *Settings*.
- **Reset everything:** close the app, delete `data\app.db`, start again.
- **Clear one candidate's history:** sign in as that candidate, then **Settings → Clear my
  practice history**. The shared question bank is kept.

## Docker

```bash
docker build -t jca-mock-exam .
docker run --rm -p 3000:3000 -e ADMIN_PASSWORD=choose-something-strong -v jca-data:/app/data jca-mock-exam
```

Open <http://localhost:3000>. The named volume keeps accounts and attempts between runs.
Use `-v "%cd%\data:/app/data"` on Windows if you prefer a folder you can see.

## Troubleshooting

**Port 3000 is already in use.** Edit `Start JCA Mock.bat` and change both
`set PORT=3000` and the URL on the `start` line (for example to `3001`).

**Windows says the app can't be found / SmartScreen warns.** The `.bat` only runs
`node server.js` from its own folder. Allow it, or run `node server.js` in a
terminal opened in this folder.

**Node is missing.** Install the LTS build from <https://nodejs.org> (the app was
built against Node 22).

**A blank page.** Make sure the black window is still open; it is the server.
Refresh after it prints `Ready`.

**"Too many failed attempts."** Five wrong passwords for one username lock that
username + device for 15 minutes. Wait, or delete `data\app.db` to start fresh
(this erases attempts too).

**Forgot the admin password.** There is no reset screen. Either restore an older
backup or delete `data\app.db`, set `ADMIN_PASSWORD` in `Start JCA Mock.bat`, and
start again.
