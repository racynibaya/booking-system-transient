"use client";

import {
  Building2,
  CalendarCheck,
  CalendarDays,
  ChevronDown,
  Inbox,
  LayoutGrid,
  LineChart,
  Settings,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { href: "/properties", label: "Properties", icon: Building2 },
  { href: "/bookings", label: "Bookings", icon: CalendarCheck },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/earnings", label: "Earnings", icon: Wallet },
  { href: "/insights", label: "Insights", icon: LineChart },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

// Properties, Earnings + Insights are the lower-frequency sections, so both navs move them out
// of the primary five: the mobile tab bar drops them (all reachable from the dashboard) and the
// tablet-width top nav tucks them under a "More" dropdown. Wide desktop (lg+) shows all eight.
const SECONDARY_HREFS = new Set(["/properties", "/earnings", "/insights"]);
const SECONDARY_ITEMS = ITEMS.filter((it) => SECONDARY_HREFS.has(it.href));
const BOTTOM_ITEMS = ITEMS.filter((it) => !SECONDARY_HREFS.has(it.href));

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

// Inline links in the header. Active item sits in a sea-tinted pill so the current section
// reads at a glance; others lift to a soft fill on hover. Eight full labels overflow at tablet
// widths, so there the lower-frequency three collapse into a "More" dropdown; lg+ has room to
// show every section inline (and the dropdown hides).
export function TopNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);

  // Dismiss the dropdown on outside click or Escape (Escape returns focus to the trigger).
  useEffect(() => {
    if (!moreOpen) return;
    function onPointerDown(e: PointerEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMoreOpen(false);
        moreButtonRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [moreOpen]);

  const moreActive = SECONDARY_ITEMS.some((it) => isActive(pathname, it.href));

  return (
    <nav className="hidden items-center gap-1 md:flex">
      {ITEMS.map((it) => {
        const active = isActive(pathname, it.href);
        // Secondary sections live under "More" until lg, where they go inline.
        const secondary = SECONDARY_HREFS.has(it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            className={`rounded-full px-3.5 py-2 text-nav-link transition-colors ${
              secondary ? "hidden lg:block" : ""
            } ${
              active
                ? "bg-primary/10 text-primary"
                : "text-muted hover:bg-surface-soft hover:text-ink"
            }`}
          >
            {it.label}
          </Link>
        );
      })}

      <div ref={moreRef} className="relative lg:hidden">
        <button
          type="button"
          ref={moreButtonRef}
          onClick={() => setMoreOpen((o) => !o)}
          aria-expanded={moreOpen}
          aria-controls="operator-nav-more"
          className={`flex items-center gap-1 rounded-full py-2 pr-2.5 pl-3.5 text-nav-link transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
            moreActive || moreOpen
              ? "bg-primary/10 text-primary"
              : "text-muted hover:bg-surface-soft hover:text-ink"
          }`}
        >
          More
          <ChevronDown
            className={`size-4 transition-transform ${moreOpen ? "rotate-180" : ""}`}
          />
        </button>
        {moreOpen && (
          <div
            id="operator-nav-more"
            className="absolute right-0 top-full z-50 mt-1.5 min-w-44 origin-top-right animate-menu-pop rounded-2xl border border-hairline bg-canvas/95 p-1 shadow-e3 backdrop-blur-md"
          >
            {SECONDARY_ITEMS.map((it) => {
              const active = isActive(pathname, it.href);
              const Icon = it.icon;
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  onClick={() => setMoreOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-nav-link transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted hover:bg-surface-soft hover:text-ink"
                  }`}
                >
                  <Icon className="size-4" />
                  {it.label}
                </Link>
              );
            })}
          </div>
        )}
      </div>
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
      {BOTTOM_ITEMS.map((it) => {
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
