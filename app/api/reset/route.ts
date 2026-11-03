import { NextResponse } from "next/server";
import { clearAttempts } from "@/lib/reset";

export const dynamic = "force-dynamic";

/**
 * Delete all practice history (attempts, papers, answers) but keep the question
 * bank. Used by the Settings page when the local test data is no longer wanted.
 */
export async function POST() {
  try {
    const report = clearAttempts();
    return NextResponse.json({ ok: true, report });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
