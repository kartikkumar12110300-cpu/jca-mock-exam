# JCA Mock Exam — portable edition

A self-contained copy of the app. No install, no account, no internet.

## Windows: double-click

1. Extract the whole folder somewhere you can write to (e.g. `Documents\JCA Mock Exam`).
2. Double-click **`Start JCA Mock.bat`**.
3. Your browser opens at <http://localhost:3000>.
4. Close the black window to stop the app.

The first run creates `data\app.db` and fills it with the bundled question bank.

> Keep the folder together. `server.js`, `.next\`, `node_modules\`, `drizzle\`
> and `content\` are all needed. `data\` is the only folder that changes.

## Your data

Everything — questions, papers, attempts, answers — lives in **`data\app.db`**.
Nothing is sent anywhere.

- **Back up:** open **Settings** in the app and click *Download backup*.
- **Move machines:** copy the folder, then restore the backup from *Settings*.
- **Reset:** close the app, delete `data\app.db`, start again.

## Docker

```bash
docker build -t jca-mock-exam .
docker run --rm -p 3000:3000 -v jca-data:/app/data jca-mock-exam
```

Open <http://localhost:3000>. The named volume keeps your attempts between runs.
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
