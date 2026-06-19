import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";

import { signOut } from "@/app/auth/actions";
import { AdminBottomNav, AdminTopNav } from "@/components/admin/admin-nav";
import { Button } from "@/components/ui/button";
import { getCurrentTenant, requireUser } from "@/lib/supabase/dal";

// Admin shell — a separate surface from the operator app (app/(app)/layout.tsx), in its own
// route group so it doesn't inherit the operator nav or the verification banners. Gated on
// is_admin here for the first render; each page self-gates too (requireAdmin), because layouts
// don't re-run on navigation under Partial Rendering (see lib/supabase/dal.ts).
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  const tenant = await getCurrentTenant();
  if (!tenant?.is_admin) notFound();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-hairline bg-canvas/80 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-4 px-4 md:h-20 md:px-6">
          <div className="flex items-center gap-6">
            <Link href="/admin" className="flex items-center gap-2.5">
              <Image
                src="/logo/tuloy-logo.svg"
                alt="Tuloy"
                width={52}
                height={28}
                priority
                className="h-7 w-auto"
              />
              <span className="rounded-full border border-primary/30 bg-primary/5 px-2 py-0.5 text-caption-sm font-medium text-primary">
                Admin
              </span>
            </Link>
            <AdminTopNav />
          </div>

          <div className="flex items-center gap-3">
            <form action={signOut}>
              <Button type="submit" variant="secondary" size="sm">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>

      {/* pb-24 clears the fixed mobile bottom nav */}
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 pb-24 md:px-6 md:py-8 md:pb-10">
        {children}
      </main>

      <AdminBottomNav />
    </div>
  );
}
