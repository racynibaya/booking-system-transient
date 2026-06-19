import { TriangleAlert } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { signOut } from "@/app/auth/actions";
import { BottomNav, TopNav } from "@/components/app/operator-nav";
import { Button } from "@/components/ui/button";
import { isOlderThanHours } from "@/lib/dates";
import { getCurrentTenant, requireUser } from "@/lib/supabase/dal";

// Operator shell. Slim header on all sizes (brand + desktop nav + sign-out); a
// thumb-reachable bottom tab bar on mobile. requireUser() gates the first server
// render; each page also calls it (Partial Rendering doesn't re-run layouts).
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  const tenant = await getCurrentTenant();

  // An approved operator who changed their GCash is re-verifying: live for a 3-day grace window,
  // then paused (the public gate hides them) until an admin re-confirms.
  const gcashChangedAt =
    tenant?.verification_status === "approved" ? tenant.gcash_changed_at : null;
  const gcashPaused = gcashChangedAt ? isOlderThanHours(gcashChangedAt, 72) : false;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-hairline bg-canvas/80 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-4 px-4 md:h-20 md:px-6">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="flex items-center">
              <Image
                src="/logo/tuloy-logo.svg"
                alt="Tuloy"
                width={52}
                height={28}
                priority
                className="h-7 w-auto"
              />
            </Link>
            <TopNav />
          </div>

          <div className="flex items-center gap-3">
            {tenant?.is_admin && (
              <Link
                href="/admin/operators"
                className="text-body-sm font-medium text-primary transition-colors hover:text-primary-active"
              >
                Admin
              </Link>
            )}
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

      {tenant?.verification_status === "pending" && (
        <div className="border-b border-hairline bg-surface-soft">
          <div className="mx-auto flex max-w-5xl items-start gap-2 px-4 py-3 text-body-sm text-ink md:px-6">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-primary" />
            <span>
              Your account is under review.{" "}
              <Link
                href="/verification"
                className="font-medium text-primary underline-offset-2 hover:underline"
              >
                Upload your verification documents
              </Link>{" "}
              so we can approve you and put your booking page live.
            </span>
          </div>
        </div>
      )}
      {tenant?.verification_status === "changes_requested" && (
        <div className="border-b border-hairline bg-surface-soft">
          <div className="mx-auto flex max-w-5xl items-start gap-2 px-4 py-3 text-body-sm text-ink md:px-6">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-primary" />
            <span>
              Action needed — {tenant.verification_note ?? "please re-upload your documents."}{" "}
              <Link
                href="/verification"
                className="font-medium text-primary underline-offset-2 hover:underline"
              >
                Update your verification.
              </Link>
            </span>
          </div>
        </div>
      )}
      {tenant?.verification_status === "suspended" && (
        <div className="border-b border-hairline bg-surface-soft">
          <div className="mx-auto flex max-w-5xl items-start gap-2 px-4 py-3 text-body-sm text-error md:px-6">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            <span>
              Your account is suspended and your booking page is offline. Contact support if you
              think this is a mistake.
            </span>
          </div>
        </div>
      )}
      {gcashChangedAt && (
        <div className="border-b border-hairline bg-surface-soft">
          <div className="mx-auto flex max-w-5xl items-start gap-2 px-4 py-3 text-body-sm text-ink md:px-6">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-primary" />
            <span>
              {gcashPaused ? (
                <>
                  Your booking page is paused — your GCash change needs verification. It resumes
                  once we confirm the GCash name matches your ID.
                </>
              ) : (
                <>
                  You changed your GCash, so we&rsquo;re re-verifying it. Your page stays live for 3
                  days — make sure the GCash name matches your ID, or it pauses until we confirm.
                </>
              )}
            </span>
          </div>
        </div>
      )}

      {/* pb-24 clears the fixed mobile bottom nav */}
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 pb-24 md:px-6 md:py-8 md:pb-10">
        {children}
      </main>

      <BottomNav />
    </div>
  );
}
