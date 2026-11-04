/**
 * Seed the question bank from the built-in set.
 *
 * The app already seeds itself on first boot when the bank is empty (see
 * `lib/db/index.ts`), so this script is a manual escape hatch:
 *
 *   npm run db:seed
 *
 * It is idempotent — questions already in the bank are skipped by content hash.
 */
import { db, dbReady } from "./index";
import { questions } from "./schema";
import { seedRows } from "./seed-data";

async function main(): Promise<void> {
  await dbReady;

  const rows = seedRows();
  const existing = new Set<string>(
    (await db.select({ hash: questions.contentHash }).from(questions).all()).map((r) => r.hash),
  );
  const missing = rows.filter((row) => !existing.has(row.contentHash ?? ""));

  if (missing.length === 0) {
    console.log(`Question bank already has all ${rows.length} seed questions.`);
    return;
  }

  await db.insert(questions).values(missing).run();
  console.log(`Seeded ${missing.length} question(s).`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
