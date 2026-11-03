import { NextResponse } from "next/server";
import { exportBackup } from "@/lib/backup";

export const dynamic = "force-dynamic";

/** Download the whole app state as a JSON file. */
export function GET() {
  try {
    const backup = exportBackup();
    const stamp = new Date().toISOString().slice(0, 10);
    return new NextResponse(JSON.stringify(backup, null, 2), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="jca-backup-${stamp}.json"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
