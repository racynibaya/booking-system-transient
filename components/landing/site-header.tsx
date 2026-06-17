import Link from "next/link";
import { Waves } from "lucide-react";
import { CtaButton } from "./cta-button";

const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Pricing", href: "#pricing" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-hairline bg-canvas/80 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-md bg-ink text-canvas">
            <Waves className="size-4" />
          </span>
          <span className="text-display-sm font-semibold text-ink">Tuloy</span>
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

        <div className="flex items-center gap-3">
          <Link
            href="#"
            className="hidden text-nav-link text-ink transition-colors hover:text-muted sm:block"
          >
            Sign in
          </Link>
          <CtaButton href="#">Get started</CtaButton>
        </div>
      </div>
    </header>
  );
}
