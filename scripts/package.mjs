/**
 * Build a portable folder + zip from `next build` output.
 *
 *   npm run build
 *   npm run package
 *
 * Produces `dist/jca-mock-exam-portable/` and `dist/jca-mock-exam-portable.zip`.
 * The folder is self-contained: double-click `Start JCA Mock.bat` on Windows.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const dist = path.join(root, "dist");
const out = path.join(dist, "jca-mock-exam-portable");
const standalone = path.join(root, ".next", "standalone");

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

if (!fs.existsSync(path.join(standalone, "server.js"))) {
  fail("No standalone build found. Run `npm run build` first (with dev stopped).");
}

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

function copy(from, to) {
  fs.cpSync(from, to, { recursive: true });
  console.log(`  copied ${path.relative(root, from)}`);
}

copy(standalone, out);
copy(path.join(root, ".next", "static"), path.join(out, ".next", "static"));
copy(path.join(root, "public"), path.join(out, "public"));
copy(path.join(root, "drizzle"), path.join(out, "drizzle"));
copy(path.join(root, "content"), path.join(out, "content"));

/**
 * Drop build-only packages the server never loads at runtime:
 *   @img + sharp   Next image optimisation — this app renders no images
 *   typescript     needed to build, not to serve
 *   caniuse-lite   browserslist data, build-time only
 * Cuts the folder from ~65 MB / 2,275 files to ~36 MB / 1,650 files.
 */
for (const pkg of ["@img", "sharp", "typescript", "caniuse-lite"]) {
  fs.rmSync(path.join(out, "node_modules", pkg), { recursive: true, force: true });
}
console.log("  pruned build-only node_modules");

// The standalone trace can still pick these up (older Next versions ignore the
// excludes, and a stale dist/ may exist at build time). A shipped package must
// never contain local state or a nested copy of itself.
for (const unwanted of ["data", "dist"]) {
  fs.rmSync(path.join(out, unwanted), { recursive: true, force: true });
}

fs.mkdirSync(path.join(out, "data"), { recursive: true });
fs.writeFileSync(path.join(out, "data", ".gitkeep"), "");

const bat = `@echo off
setlocal
cd /d "%~dp0"
if not exist "data" mkdir "data"
set PORT=3000
set HOSTNAME=127.0.0.1
echo.
echo   JCA Mock Exam
echo   Starting at http://localhost:%PORT%
echo   Close this window to stop the app.
echo.
start "" "http://localhost:%PORT%"
node server.js
pause
`;

fs.writeFileSync(path.join(out, "Start JCA Mock.bat"), bat.replace(/\n/g, "\r\n"));

fs.copyFileSync(
  path.join(root, "README-PORTABLE.md"),
  path.join(out, "README-PORTABLE.md"),
);

/** Fail the build rather than ship a package containing local state. */
function assertClean(dir) {
  const problems = [];
  const packageName = path.basename(out);

  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      const rel = path.relative(out, full);

      if (entry.isDirectory()) {
        if (entry.name === packageName) problems.push(`${rel} (nested package)`);
        walk(full);
      } else if (/\.db(-shm|-wal)?$/.test(entry.name)) {
        problems.push(rel);
      }
    }
  };

  walk(dir);

  if (problems.length > 0) {
    fail(`Package contains local state:\n  ${problems.join("\n  ")}`);
  }
}

assertClean(out);

const zip = path.join(dist, "jca-mock-exam-portable.zip");
fs.rmSync(zip, { force: true });

try {
  execFileSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-Command",
      `Compress-Archive -Path '${out.replace(/'/g, "''")}\\*' -DestinationPath '${zip.replace(/'/g, "''")}' -Force`,
    ],
    { stdio: "inherit" },
  );
  console.log(`✓ ${path.relative(root, zip)}`);
} catch {
  console.warn("! Could not create the zip automatically. The folder is ready to copy.");
}

console.log(`✓ ${path.relative(root, out)}`);
