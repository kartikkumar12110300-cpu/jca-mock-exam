import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { exportBackup } from "@/lib/backup";

export const dynamic = "force-dynamic";

/** Download the whole app state as a JSON file. Admin only. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  }
  if (user.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Administrators only." }, { status: 403 });
  }

  try {
    const backup = await exportBackup();
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
