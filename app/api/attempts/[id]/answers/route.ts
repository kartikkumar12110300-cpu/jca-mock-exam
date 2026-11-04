import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { saveAnswers } from "@/lib/attempts";
import { saveAnswersSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  }

  const { id } = await params;

  const json = await request.json().catch(() => null);
  const parsed = saveAnswersSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid payload", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const result = await saveAnswers(id, user, parsed.data.answers);

  if (!result.ok) {
    // A paper owned by somebody else is indistinguishable from a missing one.
    const status = result.reason === "missing" ? 404 : 409;
    return NextResponse.json(result, { status });
  }

  return NextResponse.json(result);
}
