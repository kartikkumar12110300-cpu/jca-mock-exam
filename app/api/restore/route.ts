import { getApiUser } from "@/lib/auth/guards";
import {
  RestoreError,
  backupSchema,
  restoreModeSchema,
  restoreUserData,
} from "@/lib/backup";
import { failure, json, serverFailure } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = await getApiUser();
    if (!user) return failure("Authentication required", 401);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return failure("Invalid JSON body");
    }

    const raw = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
    const mode = restoreModeSchema.safeParse(raw.mode ?? "merge");
    if (!mode.success) {
      return failure('Restore mode must be "merge" or "replace".', 422);
    }

    const parsed = backupSchema.safeParse(body);
    if (!parsed.success) {
      return failure(parsed.error.issues[0]?.message || "Invalid backup file", 422);
    }

    try {
      const result = await restoreUserData(user.id, parsed.data, mode.data);
      return json({ ok: true, mode: mode.data, ...result });
    } catch (error) {
      if (error instanceof RestoreError) return failure(error.message, 422);
      throw error;
    }
  } catch (error) {
    return serverFailure(error);
  }
}
