/**
 * End-to-end smoke test of the attempt lifecycle, straight against the DB layer.
 * Run: npm run smoke
 */
import { createFullMock, getAttemptBundle, saveAnswers, submitAttempt } from "../lib/attempts";

const attemptId = createFullMock();
const bundle = getAttemptBundle(attemptId);

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

const saved = saveAnswers(attemptId, [...correct, ...wrong]);
console.log(`save      ${JSON.stringify(saved)}`);

const result = submitAttempt(attemptId);
if (!result.ok) throw new Error("Submit failed");

console.log(`net       ${result.score.net}  (expected 9: 10 correct, 4 wrong)`);
console.log(`correct   ${result.score.correct}`);
console.log(`wrong     ${result.score.wrong}`);
console.log(`skipped   ${result.score.skipped}`);

// Submitting twice must return the same stored score.
const again = submitAttempt(attemptId);
if (!again.ok || again.score.net !== result.score.net) {
  throw new Error("Submit is not idempotent");
}
console.log("resubmit  idempotent ok");
