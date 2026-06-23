import Image from "next/image";
import Link from "next/link";

const FOOTER_LINKS = [
  { label: "Features", href: "/about#features" },
  { label: "How it works", href: "/about#how-it-works" },
  { label: "Pricing", href: "/about#pricing" },
  { label: "Sign in", href: "/login" },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-hairline bg-canvas px-6 py-12">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 md:flex-row">
        <div className="flex items-center">
          <Image
            src="/logo/tuloy-logo.svg"
            alt="Tuloy"
            width={59}
            height={32}
            className="h-8 w-auto"
          />
        </div>

        <nav className="flex flex-wrap items-center justify-center gap-6">
          {FOOTER_LINKS.map((l) => (
            <Link
              key={l.label}
              href={l.href}
              className="text-body-sm text-muted transition-colors hover:text-ink"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <p className="text-caption-sm text-muted">© 2026 Tuloy · San Juan, La Union</p>
      </div>
    </footer>
  );
}
