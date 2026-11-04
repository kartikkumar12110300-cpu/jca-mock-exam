/**
 * End-to-end smoke test of the attempt lifecycle, straight against the DB layer.
 * Run: npm run smoke
 *
 * Uses the seeded `user1` account. First boot seeds it (see lib/db/index.ts), so
 * this works against an empty database too.
 */
import { eq } from "drizzle-orm";
import { createFullMock, getAttemptBundle, saveAnswers, submitAttempt } from "../lib/attempts";
import { db, dbReady } from "../lib/db";
import { users } from "../lib/db/schema";

async function main(): Promise<void> {
  await dbReady;

  const user = await db.select().from(users).where(eq(users.username, "user1")).get();
  if (!user) throw new Error("Seeded user1 account is missing");

  const attemptId = await createFullMock(user.id);
  const bundle = await getAttemptBundle(attemptId, user);

  if (!bundle) throw new Error("Attempt was not created");

  console.log(`attempt   ${attemptId}`);
  console.log(`questions ${bundle.questions.length}`);
  console.log(`duration  ${bundle.test.durationSec}s`);

  const correct = bundle.questions
    .slice(0, 10)
    .map((q) => ({ questionId: q.id, selectedIndex: q.correctIndex ?? 0 }));

  const wrong = bundle.questions
    .slice(10, 14)
    .map((q) => ({ questionId: q.id, selectedIndex: ((q.correctIndex ?? 0) + 1) % 4 }));

  const saved = await saveAnswers(attemptId, user, [...correct, ...wrong]);
  console.log(`save      ${JSON.stringify(saved)}`);

  const result = await submitAttempt(attemptId, user);
  if (!result.ok) throw new Error("Submit failed");

  console.log(`net       ${result.score.net}  (expected 9: 10 correct, 4 wrong)`);
  console.log(`correct   ${result.score.correct}`);
  console.log(`wrong     ${result.score.wrong}`);
  console.log(`skipped   ${result.score.skipped}`);

  // Submitting twice must return the same stored score.
  const again = await submitAttempt(attemptId, user);
  if (!again.ok || again.score.net !== result.score.net) {
    throw new Error("Submit is not idempotent");
  }
  console.log("resubmit  idempotent ok");

  // An admin may read the paper but must not be able to write to it.
  const admin = await db.select().from(users).where(eq(users.username, "admin")).get();
  if (admin) {
    const asAdmin = await getAttemptBundle(attemptId, admin);
    console.log(`admin read ${asAdmin ? "ok" : "DENIED"}`);
    const write = await saveAnswers(attemptId, admin, correct);
    if (write.ok) throw new Error("Admin was able to write to another user's attempt");
    console.log("admin write denied ok");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
