import Image from "next/image";
import Link from "next/link";
import { CtaButton } from "./cta-button";
import { MobileMenu } from "./mobile-menu";

const NAV_LINKS = [
  { label: "Features", href: "/about#features" },
  { label: "How it works", href: "/about#how-it-works" },
  { label: "Pricing", href: "/about#pricing" },
];

export function SiteHeader() {
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

        <nav className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-nav-link text-muted transition-colors hover:text-ink"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <CtaButton href="/login">Get started</CtaButton>
          <MobileMenu links={NAV_LINKS} />
        </div>
      </div>
    </header>
  );
}
