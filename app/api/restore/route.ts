import { NextResponse } from "next/server";
import { backupSchema, restoreBackup } from "@/lib/backup";

export const dynamic = "force-dynamic";

/**
 * Restore a backup. Accepts multipart/form-data with:
 *   file  — the exported JSON
 *   mode  — "replace" (default) or "merge"
 *
 * The whole file is validated before a single row is written.
 */
export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    const mode = String(form.get("mode") ?? "replace") === "merge" ? "merge" : "replace";

    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "No file uploaded." }, { status: 400 });
    }

    let raw: unknown;
    try {
      raw = JSON.parse(await file.text());
    } catch {
      return NextResponse.json(
        { ok: false, error: "That file is not valid JSON." },
        { status: 400 },
      );
    }

    const parsed = backupSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: "That does not look like a JCA backup file.",
          issues: parsed.error.issues.slice(0, 5).map((i) => ({
            path: i.path.join("."),
            message: i.message,
          })),
        },
        { status: 400 },
      );
    }

    const report = restoreBackup(parsed.data, { mode });
    return NextResponse.json({ ok: true, report });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
