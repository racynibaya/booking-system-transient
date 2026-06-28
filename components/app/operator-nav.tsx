"use client";

import { Building2, CalendarCheck, LayoutGrid, Settings, Wallet } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { href: "/properties", label: "Properties", icon: Building2 },
  { href: "/bookings", label: "Bookings", icon: CalendarCheck },
  { href: "/earnings", label: "Earnings", icon: Wallet },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

// Inline links in the header (desktop). Active item sits in a sea-tinted pill so the
// current section reads at a glance; others lift to a soft fill on hover.
export function TopNav() {
  const pathname = usePathname();
  return (
    <nav className="hidden items-center gap-1 md:flex">
      {ITEMS.map((it) => {
        const active = isActive(pathname, it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            className={`rounded-full px-3.5 py-2 text-nav-link transition-colors ${
              active
                ? "bg-primary/10 text-primary"
                : "text-muted hover:bg-surface-soft hover:text-ink"
            }`}
          >
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}

// Thumb-reachable tab bar fixed to the bottom (mobile only). Five evenly-distributed tabs;
// the active tab's icon sits in a sea-tinted orb so the current section is unmistakable on a
// glance. Labels drop to 11px (tab-bar convention) so all five sit on one line from small
// phones up through Pro Max widths; truncate is a safety net against overflow.
export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 border-t border-hairline bg-canvas/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
    >
      {ITEMS.map((it) => {
        const active = isActive(pathname, it.href);
        const Icon = it.icon;
        return (
          <Link
            key={it.href}
            href={it.href}
            aria-current={active ? "page" : undefined}
            className={`flex min-w-0 flex-col items-center gap-1 px-0.5 pt-2 pb-2.5 text-[11px] leading-none transition-colors ${
              active ? "text-primary" : "text-muted"
            }`}
          >
            <span
              className={`flex h-7 w-12 items-center justify-center rounded-full transition-colors ${
                active ? "bg-primary/12" : ""
              }`}
            >
              <Icon className="size-5" />
            </span>
            <span className="w-full truncate text-center">{it.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
