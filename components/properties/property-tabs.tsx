"use client";

import { BedDouble, ImageIcon, SlidersHorizontal } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";

type TabId = "rooms" | "details" | "cover";

// Labels stay short so three equal-width (flex-1) tabs fit a ~360px phone without clipping; the
// full "Cover photo" wording lives in the panel heading.
const TABS: { id: TabId; label: string; icon: LucideIcon }[] = [
  { id: "rooms", label: "Rooms", icon: BedDouble },
  { id: "details", label: "Details", icon: SlidersHorizontal },
  { id: "cover", label: "Cover", icon: ImageIcon },
];

function isTab(v: string | null): v is TabId {
  return v === "rooms" || v === "details" || v === "cover";
}

// Splits the property page into three focused tabs so it stops being one overwhelming scroll.
// Rooms leads (the daily work); Details and Cover photo are settings you visit occasionally. All
// three panels stay mounted and are hidden via `hidden` so an in-progress form edit survives a tab
// switch. The active tab syncs to ?tab= (shareable + reload-stable, like the bookings ?view=).
export function PropertyTabs({
  rooms,
  details,
  cover,
}: {
  rooms: ReactNode;
  details: ReactNode;
  cover: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initial = searchParams.get("tab");
  const [active, setActive] = useState<TabId>(isTab(initial) ? initial : "rooms");

  function select(id: TabId) {
    setActive(id);
    const params = new URLSearchParams(searchParams);
    if (id === "rooms") params.delete("tab");
    else params.set("tab", id);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const panels: Record<TabId, ReactNode> = { rooms, details, cover };

  return (
    <div className="flex flex-col gap-6">
      <div
        role="tablist"
        aria-label="Property settings"
        className="flex gap-1 overflow-x-auto rounded-full border border-hairline bg-canvas p-1"
      >
        {TABS.map((t) => {
          const on = active === t.id;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => select(t.id)}
              className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-button-sm whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
                on
                  ? "bg-primary/10 text-primary"
                  : "text-muted hover:bg-surface-soft hover:text-ink"
              }`}
            >
              <Icon className="size-4 shrink-0" />
              {t.label}
            </button>
          );
        })}
      </div>

      {TABS.map((t) => (
        <div key={t.id} role="tabpanel" hidden={active !== t.id}>
          {panels[t.id]}
        </div>
      ))}
    </div>
  );
}
