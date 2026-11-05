import { getDb } from "@/lib/db/client";
import { questions } from "@/lib/db/collections";
import { json } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  const started = Date.now();
  try {
    const db = await getDb();
    await db.command({ ping: 1 });
    const count = await (await questions()).countDocuments({ status: "published" });
    return json({
      ok: true,
      db: "up",
      questions: count,
      latencyMs: Date.now() - started,
      time: new Date().toISOString(),
    });
  } catch (error) {
    console.error(error);
    return json(
      {
        ok: false,
        db: "down",
        latencyMs: Date.now() - started,
        time: new Date().toISOString(),
      },
      503,
    );
  }
}
