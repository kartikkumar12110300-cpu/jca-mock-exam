import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { submitAttempt } from "@/lib/attempts";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  }

  const { id } = await params;
  const result = await submitAttempt(id, user);

  if (!result.ok) {
    return NextResponse.json(result, { status: 404 });
  }

  return NextResponse.json(result);
}
