import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { AttemptError, createFullMock } from "@/lib/attempts";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as { kind?: string };
    const kind = body.kind ?? "full";

    if (kind !== "full") {
      return NextResponse.json(
        { ok: false, error: "Only full mocks exist so far." },
        { status: 400 },
      );
    }

    const attemptId = await createFullMock(user.id);
    return NextResponse.json({ ok: true, attemptId });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { ok: false, error: message },
      { status: error instanceof AttemptError ? 400 : 500 },
    );
  }
}
