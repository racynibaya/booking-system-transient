"use client";

import {
  Building2,
  CalendarCheck,
  CalendarDays,
  ChevronDown,
  Inbox,
  LayoutGrid,
  LineChart,
  MoreHorizontal,
  Settings,
  Star,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { href: "/bookings", label: "Bookings", icon: CalendarCheck },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/earnings", label: "Earnings", icon: Wallet },
  { href: "/properties", label: "Properties", icon: Building2 },
  { href: "/reviews", label: "Reviews", icon: Star },
  { href: "/insights", label: "Insights", icon: LineChart },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

// The five daily-operational sections (Dashboard, Bookings, Inbox, Calendar, Earnings) stay
// primary — inline in the header and on the mobile tab bar. The three lower-frequency ones
// (Properties = setup, Insights = analytics, Settings = config) live under "More" at every
// width: the header is capped at max-w-5xl, so eight full labels never fit alongside the brand
// and account controls — five inline + More is the honest ceiling.
const SECONDARY_HREFS = new Set(["/properties", "/reviews", "/insights", "/settings"]);
const SECONDARY_ITEMS = ITEMS.filter((it) => SECONDARY_HREFS.has(it.href));

// Mobile has room for four thumb tabs, so the bottom bar shows the four tap-constantly
// operational sections and folds the rest — Earnings plus the three secondary — into a "More"
// bottom sheet. Every section stays one tap away; nothing is stranded off-nav on phones.
const BOTTOM_TAB_HREFS = new Set(["/dashboard", "/bookings", "/inbox", "/calendar"]);
const BOTTOM_TABS = ITEMS.filter((it) => BOTTOM_TAB_HREFS.has(it.href));
const BOTTOM_MORE_ITEMS = ITEMS.filter((it) => !BOTTOM_TAB_HREFS.has(it.href));

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

// Inline links in the header. Active item sits in a sea-tinted pill so the current section
// reads at a glance; others lift to a soft fill on hover. The five primary sections render
// inline; the three secondary ones stay under a "More" dropdown at every width (the capped
// header can't hold eight full labels next to the brand and account controls).
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
        // Secondary sections never render inline — they live under "More".
        const secondary = SECONDARY_HREFS.has(it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            className={`rounded-full px-3.5 py-2 text-nav-link transition-colors ${
              secondary ? "hidden" : ""
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

      <div ref={moreRef} className="relative">
        <button
          type="button"
          ref={moreButtonRef}
          onClick={() => setMoreOpen((o) => !o)}
          aria-expanded={moreOpen}
          aria-controls="operator-nav-more"
          className={`flex items-center gap-1 rounded-full py-2 pr-2.5 pl-3.5 text-nav-link transition-colors focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none ${
            moreActive || moreOpen
              ? "bg-primary/10 text-primary"
              : "text-muted hover:bg-surface-soft hover:text-ink"
          }`}
        >
          More
          <ChevronDown className={`size-4 transition-transform ${moreOpen ? "rotate-180" : ""}`} />
        </button>
        {moreOpen && (
          <div
            id="operator-nav-more"
            className="absolute top-full right-0 z-50 mt-1.5 min-w-44 origin-top-right animate-menu-pop rounded-2xl border border-hairline bg-canvas/95 p-1 shadow-e3 backdrop-blur-md"
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
                  className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-nav-link transition-colors focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none ${
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

// "More" bottom sheet (mobile). Holds the sections that don't fit the four-tab bar so they stay
// reachable. Mirrors the booking bottom sheet (mobile-booking-bar.tsx): portaled scrim, rAF-driven
// entrance, Escape / backdrop / selection close, body-scroll lock; the panel rises from the edge.
function MoreSheet({ pathname, onClose }: { pathname: string; onClose: () => void }) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setShown(true));
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(raf);
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex flex-col justify-end md:hidden">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className={`absolute inset-0 bg-scrim/50 backdrop-blur-sm transition-opacity duration-300 ${
          shown ? "opacity-100" : "opacity-0"
        }`}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="More sections"
        className={`relative rounded-t-2xl border-t border-hairline bg-surface-soft pb-[calc(0.5rem+env(safe-area-inset-bottom))] shadow-card transition-transform duration-300 ease-out motion-reduce:transition-none ${
          shown ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <span className="absolute top-2 left-1/2 h-1 w-9 -translate-x-1/2 rounded-full bg-border-strong" />
        <div className="px-2 pt-5 pb-1">
          {BOTTOM_MORE_ITEMS.map((it) => {
            const active = isActive(pathname, it.href);
            const Icon = it.icon;
            return (
              <Link
                key={it.href}
                href={it.href}
                onClick={onClose}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3.5 rounded-xl px-3 py-3.5 text-body-md transition-colors focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none ${
                  active ? "bg-primary/10 text-primary" : "text-ink hover:bg-surface-strong"
                }`}
              >
                <span
                  className={`flex size-9 items-center justify-center rounded-full ${
                    active ? "bg-primary/12 text-primary" : "bg-surface-strong text-muted"
                  }`}
                >
                  <Icon className="size-5" />
                </span>
                {it.label}
              </Link>
            );
          })}
        </div>
      </div>
    </div>,
    document.body,
  );
}

// Thumb-reachable tab bar fixed to the bottom (mobile only). Four operational tabs plus a "More"
// button that opens the sheet above; the active tab's icon sits in a sea-tinted orb so the current
// section is unmistakable. Labels drop to 11px (tab-bar convention) so all five slots sit on one
// line from small phones up through Pro Max widths; truncate is a safety net against overflow.
export function BottomNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = BOTTOM_MORE_ITEMS.some((it) => isActive(pathname, it.href));

  return (
    <>
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 border-t border-hairline bg-canvas/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
      >
        {BOTTOM_TABS.map((it) => {
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

        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
          className={`flex min-w-0 flex-col items-center gap-1 px-0.5 pt-2 pb-2.5 text-[11px] leading-none transition-colors focus-visible:outline-none ${
            moreActive || moreOpen ? "text-primary" : "text-muted"
          }`}
        >
          <span
            className={`flex h-7 w-12 items-center justify-center rounded-full transition-colors ${
              moreActive || moreOpen ? "bg-primary/12" : ""
            }`}
          >
            <MoreHorizontal className="size-5" />
          </span>
          <span className="w-full truncate text-center">More</span>
        </button>
      </nav>

      {moreOpen && <MoreSheet pathname={pathname} onClose={() => setMoreOpen(false)} />}
    </>
  );
}
