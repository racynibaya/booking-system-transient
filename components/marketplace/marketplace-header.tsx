import Image from "next/image";
import Link from "next/link";
import { FavoritesNav } from "@/components/favorites/favorites-nav";
import { CtaButton } from "@/components/landing/cta-button";
import { MobileMenu } from "@/components/landing/mobile-menu";

// Guest-facing header for the marketplace homepage. Keeps the operator funnel alive via a clear
// "Start hosting free" path to /about; "Sign in" returns operators to their dashboard.
export function MarketplaceHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-hairline bg-canvas/80 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center">
          <Image
            src="/logo/tuloy-logo.svg"
            alt="Tuloy"
            width={67}
            height={36}
            priority
            className="h-9 w-auto"
          />
        </Link>

        <div className="flex items-center gap-3 md:gap-5">
          <FavoritesNav />
          <div className="hidden items-center gap-4 md:flex md:gap-5">
            <Link
              href="/login"
              className="text-nav-link text-muted transition-colors hover:text-ink"
            >
              Sign in
            </Link>
            <CtaButton href="/about">Start hosting free</CtaButton>
          </div>
          <MobileMenu
            links={[{ label: "Sign in", href: "/login" }]}
            cta={{ label: "Start hosting free", href: "/about" }}
          />
        </div>
      </div>
    </header>
  );
}
