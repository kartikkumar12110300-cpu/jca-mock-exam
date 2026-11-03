import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export function GET() {
  try {
    const row = db.get<{ n: number }>(sql`select count(*) as n from questions`);
    return NextResponse.json({ ok: true, questions: row?.n ?? 0 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
