import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { clearAttempts } from "@/lib/reset";

export const dynamic = "force-dynamic";

/**
 * Delete the signed-in user's practice history (attempts, papers, answers) but
 * keep the shared question bank and every other account.
 */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  }

  try {
    const report = await clearAttempts(user.id);
    return NextResponse.json({ ok: true, report });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
