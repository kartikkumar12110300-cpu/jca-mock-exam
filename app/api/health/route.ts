import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db, dbReady, dbUrl } from "@/lib/db";
import { questions } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await dbReady;
    const row = await db.select({ n: sql<number>`count(*)` }).from(questions).get();
    return NextResponse.json({
      ok: true,
      questions: Number(row?.n ?? 0),
      database: dbUrl,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
