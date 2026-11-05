import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { users } from "@/lib/db/collections";
import type { PublicUser, UserDoc } from "@/lib/db/types";

export interface CurrentUser extends PublicUser {
  active: boolean;
  mustChangePassword: boolean;
  createdAt: Date;
  lastLoginAt: Date | null;
}

function toPublic(user: UserDoc): CurrentUser {
  return {
    id: user._id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    active: user.active,
    mustChangePassword: Boolean(user.mustChangePassword),
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  };
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await getSession();
  if (!session) return null;
  const user = await (await users()).findOne({ _id: session.sub });
  if (!user || !user.active) return null;
  // Changing a password bumps tokenVersion and revokes every older session.
  if ((user.tokenVersion ?? 0) !== session.ver) return null;
  return toPublic(user);
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/");
  return user;
}

export async function getApiUser(): Promise<CurrentUser | null> {
  return getCurrentUser();
}

export function publicUser(user: UserDoc) {
  return toPublic(user);
}
