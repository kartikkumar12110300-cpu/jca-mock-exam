import { NextResponse } from "next/server";
import { AttemptError, createFullMock } from "@/lib/attempts";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { kind?: string };
    const kind = body.kind ?? "full";

    if (kind !== "full") {
      return NextResponse.json(
        { ok: false, error: "Only full mocks exist so far." },
        { status: 400 },
      );
    }

    const attemptId = createFullMock();
    return NextResponse.json({ ok: true, attemptId });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { ok: false, error: message },
      { status: error instanceof AttemptError ? 400 : 500 },
    );
  }
}
