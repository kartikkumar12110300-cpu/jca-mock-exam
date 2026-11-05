import { loginAttempts } from "@/lib/db/collections";

const WINDOW_MS = 15 * 60 * 1000;

/** Per username+IP: a person fat-fingering their own password. */
export const MAX_USER_ATTEMPTS = 5;
/** Per IP: stops one client from spraying many usernames. */
export const MAX_IP_ATTEMPTS = 20;

export async function isLoginBlocked(key: string, max = MAX_USER_ATTEMPTS): Promise<boolean> {
  const record = await (await loginAttempts()).findOne({ _id: key });
  if (!record) return false;
  if (record.expiresAt.getTime() <= Date.now()) return false;
  return record.count >= max;
}

export async function recordLoginFailure(key: string): Promise<void> {
  const now = new Date();
  await (await loginAttempts()).updateOne(
    { _id: key },
    {
      $inc: { count: 1 },
      $set: { lastAt: now, expiresAt: new Date(now.getTime() + WINDOW_MS) },
      $setOnInsert: { firstAt: now },
    },
    { upsert: true },
  );
}

export async function clearLoginFailures(key: string): Promise<void> {
  await (await loginAttempts()).deleteOne({ _id: key });
}
