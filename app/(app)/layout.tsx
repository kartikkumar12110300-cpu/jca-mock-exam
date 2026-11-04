import { requireUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * Guard for every candidate-facing page. Authorization is enforced here and
 * again in each data function — hiding a link is never treated as security.
 */
export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requireUser();
  return <>{children}</>;
}
