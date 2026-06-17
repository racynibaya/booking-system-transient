import { Home, MapPinOff } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { buttonClassName } from "@/components/ui/button";

// Branded fallback for any unmatched URL AND every notFound() call (e.g. an unknown
// booking slug in app/[slug]). Server Component — pure Link navigation, no client JS.
export default function NotFound() {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6 text-center">
      {/* soft on-brand glow (pale Rausch), matching the login + landing hero */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(60%_60%_at_50%_0%,var(--color-primary-disabled),transparent)] opacity-60"
      />

      <div className="relative flex w-full max-w-md flex-col items-center">
        <Link href="/" className="inline-flex items-center">
          <Image
            src="/logo/tuloy-logo.svg"
            alt="Tuloy"
            width={59}
            height={32}
            className="h-8 w-auto"
          />
        </Link>

        <span className="mt-10 flex size-14 items-center justify-center rounded-full border border-hairline bg-surface-soft text-muted">
          <MapPinOff className="size-6" />
        </span>

        <p className="mt-6 text-hero tracking-tight text-ink">404</p>
        <h1 className="mt-1 text-display-lg text-ink">We couldn&apos;t find that page</h1>
        <p className="mt-3 text-body-md leading-relaxed text-muted">
          The page or booking link may be mistyped or expired. Double-check the link, or head back
          home.
        </p>

        <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <Link href="/" className={buttonClassName({ variant: "primary" })}>
            <Home className="size-4" /> Back to home
          </Link>
          <Link href="/login" className={buttonClassName({ variant: "secondary" })}>
            Operator sign in
          </Link>
        </div>
      </div>

      <p className="relative mt-10 text-caption-sm text-muted-soft">San Juan, La Union</p>
    </main>
  );
}
