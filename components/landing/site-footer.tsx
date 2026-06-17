import Link from "next/link";
import { Waves } from "lucide-react";

const FOOTER_LINKS = [
  { label: "Features", href: "/#features" },
  { label: "How it works", href: "/#how-it-works" },
  { label: "Pricing", href: "/#pricing" },
  { label: "Sign in", href: "/login" },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-hairline bg-canvas px-6 py-12">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 md:flex-row">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-md bg-ink text-canvas">
            <Waves className="size-4" />
          </span>
          <span className="text-title-md font-semibold text-ink">Tuloy</span>
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
