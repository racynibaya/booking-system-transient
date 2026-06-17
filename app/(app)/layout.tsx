import { Waves } from "lucide-react";
import Link from "next/link";

import { signOut } from "@/app/auth/actions";
import { BottomNav, TopNav } from "@/components/app/operator-nav";
import { Button } from "@/components/ui/button";
import { getCurrentTenant, requireUser } from "@/lib/supabase/dal";

// Operator shell. Slim header on all sizes (brand + desktop nav + sign-out); a
// thumb-reachable bottom tab bar on mobile. requireUser() gates the first server
// render; each page also calls it (Partial Rendering doesn't re-run layouts).
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  const tenant = await getCurrentTenant();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-hairline bg-canvas/80 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-4 px-4 md:h-20 md:px-6">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-md bg-ink text-canvas">
                <Waves className="size-4" />
              </span>
              <span className="text-display-sm font-semibold text-ink">Tuloy</span>
            </Link>
            <TopNav />
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden max-w-[12ch] truncate text-body-sm text-muted sm:block">
              {tenant?.name ?? "Operator"}
            </span>
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

      <BottomNav />
    </div>
  );
}
