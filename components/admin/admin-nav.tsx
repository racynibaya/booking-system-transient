"use client";

import { LayoutGrid, RotateCcw, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

// Admin surface nav — deliberately separate from the operator nav (components/app/operator-nav).
// The admin manages the platform, not their own listings, so the items are platform-scoped.
const ITEMS = [
  { href: "/admin", label: "Overview", icon: LayoutGrid },
  { href: "/admin/operators", label: "Operators", icon: ShieldCheck },
  { href: "/admin/refunds", label: "Refunds", icon: RotateCcw },
] as const;

// /admin must match exactly so it doesn't stay active on /admin/operators.
function isActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

// Inline links in the header (desktop).
export function AdminTopNav() {
  const pathname = usePathname();
  return (
    <nav className="hidden items-center gap-1 md:flex">
      {ITEMS.map((it) => {
        const active = isActive(pathname, it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            className={`rounded-sm px-3 py-2 text-nav-link transition-colors ${
              active ? "text-ink" : "text-muted hover:text-ink"
            }`}
          >
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}

// Thumb-reachable tab bar fixed to the bottom (mobile only). Active tab in Rausch.
export function AdminBottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-2 border-t border-hairline bg-canvas/95 backdrop-blur md:hidden">
      {ITEMS.map((it) => {
        const active = isActive(pathname, it.href);
        const Icon = it.icon;
        return (
          <Link
            key={it.href}
            href={it.href}
            className={`flex flex-col items-center gap-1 py-2.5 text-caption-sm transition-colors ${
              active ? "text-primary" : "text-muted"
            }`}
          >
            <Icon className="size-5" />
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
