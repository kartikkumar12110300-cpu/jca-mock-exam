import { SiteHeader } from "@/components/site-header";
import { requireAdmin } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * Every admin page is guarded here. The data-layer functions never rely on the
 * layout alone, but this keeps an unauthenticated visitor from ever seeing the
 * shell.
 */
export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requireAdmin();

  return (
    <>
      <SiteHeader />
      {children}
    </>
  );
}
