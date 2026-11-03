/**
 * Import questions from JSON.
 *
 *   npm run import -- content/sample.json
 *   npm run import -- content/*.json --dry-run
 *   npm run import -- content/          (every .json in the folder)
 */
import fs from "node:fs";
import path from "node:path";
import { db } from "../lib/db";
import { importFileSchema, importPayload } from "../lib/import";

function collect(targets: string[]): string[] {
  const files: string[] = [];
  for (const target of targets) {
    const resolved = path.resolve(target);
    if (!fs.existsSync(resolved)) {
      console.error(`not found: ${target}`);
      continue;
    }
    if (fs.statSync(resolved).isDirectory()) {
      for (const entry of fs.readdirSync(resolved)) {
        if (entry.endsWith(".json")) files.push(path.join(resolved, entry));
      }
    } else {
      files.push(resolved);
    }
  }
  return files;
}

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const targets = args.filter((a) => !a.startsWith("--"));

  if (targets.length === 0) {
    console.error("usage: npm run import -- <file-or-folder> [--dry-run]");
    process.exit(1);
  }

  const files = collect(targets);
  if (files.length === 0) {
    console.error("no .json files found");
    process.exit(1);
  }

  let inserted = 0;
  let skipped = 0;
  let invalid = 0;

  for (const file of files) {
    let raw: unknown;
    try {
      raw = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch (error) {
      console.error(`✗ ${path.basename(file)} — invalid JSON: ${(error as Error).message}`);
      invalid += 1;
      continue;
    }

    const parsed = importFileSchema.safeParse(raw);
    if (!parsed.success) {
      console.error(`✗ ${path.basename(file)} — schema error`);
      for (const issue of parsed.error.issues.slice(0, 10)) {
        console.error(`    ${issue.path.join(".") || "<root>"}: ${issue.message}`);
      }
      invalid += 1;
      continue;
    }

    const report = importPayload(
      parsed.data,
      {
        file: path.basename(file),
        dryRun,
      },
      db,
    );

    inserted += report.inserted;
    skipped += report.skippedDuplicates;
    invalid += report.invalid.length;

    console.log(
      `${dryRun ? "·" : "✓"} ${report.file} — ${report.inserted} ${dryRun ? "would insert" : "inserted"}, ` +
        `${report.skippedDuplicates} duplicate(s), ${report.invalid.length} invalid`,
    );
    for (const problem of report.invalid.slice(0, 10)) {
      console.error(`    #${problem.index + 1}: ${problem.message}`);
    }
  }

  console.log(
    `\n${dryRun ? "dry run" : "done"}: ${inserted} inserted, ${skipped} duplicate(s), ${invalid} invalid`,
  );

  if (invalid > 0) process.exitCode = 1;
}

main();
