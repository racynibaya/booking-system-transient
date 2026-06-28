import { ShieldCheck } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

// Guest-facing marketplace footer. Separate from the operator-landing SiteFooter (/about) by design:
// different audience, different link set. Multi-column so the page closes like a real business, not a
// directory — but every link is real (no invented sitemap), staying on Tuloy's honest-proof footing.
const COLUMNS: { heading: string; links: { label: string; href: string }[] }[] = [
  {
    heading: "Explore",
    links: [
      { label: "Browse stays", href: "/" },
      { label: "About Tuloy", href: "/about" },
    ],
  },
  {
    heading: "For hosts",
    links: [
      { label: "List your property", href: "/about" },
      { label: "How it works", href: "/about#how-it-works" },
      { label: "Pricing", href: "/about#pricing" },
      { label: "Sign in", href: "/login" },
    ],
  },
];

export function MarketplaceFooter() {
  return (
    <footer className="border-t border-hairline bg-canvas">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-x-6 gap-y-10 px-6 py-14 sm:grid-cols-4">
        {/* Brand column — the one place the footer earns its weight: who Tuloy is, in one honest line. */}
        <div className="col-span-2">
          <Image
            src="/logo/tuloy-logo.svg"
            alt="Tuloy"
            width={67}
            height={36}
            className="h-9 w-auto"
          />
          <p className="mt-4 max-w-xs text-body-sm text-pretty text-muted">
            Every San Juan, La Union stay in one place — verified hosts, live availability, and a
            secure booking.
          </p>
          <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-hairline bg-surface-soft/60 px-3 py-1.5 text-caption-sm text-body">
            <ShieldCheck className="size-3.5 shrink-0 text-primary" /> Every host verified by Tuloy
          </p>
        </div>

        {COLUMNS.map((col) => (
          <div key={col.heading}>
            <h2 className="text-micro-label text-muted uppercase">{col.heading}</h2>
            <ul className="mt-4 flex flex-col gap-3">
              {col.links.map((l) => (
                <li key={l.label}>
                  <Link
                    href={l.href}
                    className="text-body-sm text-body transition-colors hover:text-ink"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-hairline-soft">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-6 py-6 sm:flex-row">
          <p className="text-caption-sm text-muted">© 2026 Tuloy · San Juan, La Union</p>
          <p className="text-caption-sm text-muted-soft">Built for the local surf town.</p>
        </div>
      </div>
    </footer>
  );
}
