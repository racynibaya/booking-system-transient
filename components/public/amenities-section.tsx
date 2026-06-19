"use client";

import {
  BedDouble,
  Check,
  Coffee,
  CookingPot,
  Fan,
  Mountain,
  PawPrint,
  Refrigerator,
  ShowerHead,
  Snowflake,
  SquareParking,
  Tv,
  Umbrella,
  Utensils,
  WashingMachine,
  Waves,
  Wifi,
  Wind,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

// Operator amenities are free-text strings, so match on normalized keywords and fall back to
// a neutral dot. Order matters: more specific terms (e.g. "hot shower") before broad ones.
const ICON_RULES: { test: RegExp; icon: LucideIcon }[] = [
  { test: /wi-?fi|internet/, icon: Wifi },
  { test: /parking/, icon: SquareParking },
  { test: /surf/, icon: Waves },
  { test: /shower|hot water/, icon: ShowerHead },
  { test: /air ?con|a\/?c\b|aircon/, icon: Snowflake },
  { test: /\bfan\b/, icon: Fan },
  { test: /kitchen|stove|cook/, icon: CookingPot },
  { test: /breakfast|coffee/, icon: Coffee },
  { test: /\btv\b|netflix|cable/, icon: Tv },
  { test: /fridge|refriger/, icon: Refrigerator },
  { test: /laundry|wash/, icon: WashingMachine },
  { test: /pet/, icon: PawPrint },
  { test: /generator|power|backup/, icon: Zap },
  { test: /view|balcony|mountain/, icon: Mountain },
  { test: /beach|umbrella/, icon: Umbrella },
  { test: /pool|jacuzzi/, icon: Waves },
  { test: /bed|linen/, icon: BedDouble },
  { test: /towel|toiletr/, icon: ShowerHead },
  { test: /dining|table|utensil/, icon: Utensils },
  { test: /vent|breeze/, icon: Wind },
];

function iconFor(amenity: string): LucideIcon {
  const s = amenity.toLowerCase();
  // Curated amenities always match a rule; custom "Other" entries fall back to a neutral check.
  return ICON_RULES.find((r) => r.test.test(s))?.icon ?? Check;
}

// Show a handful inline; the rest live behind "Show all" (Airbnb pattern).
const PREVIEW_COUNT = 6;

// Full list in a portaled modal — scrim, Escape / backdrop-click to close, body-scroll lock,
// and a subtle opacity+scale entrance. Mirrors components/ui/confirm-dialog.tsx.
function AmenitiesModal({ amenities, onClose }: { amenities: string[]; onClose: () => void }) {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className={`absolute inset-0 bg-scrim/50 backdrop-blur-sm transition-opacity duration-200 ${
          shown ? "opacity-100" : "opacity-0"
        }`}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="What this place offers"
        className={`relative flex max-h-[85vh] w-full max-w-lg flex-col rounded-md border border-hairline bg-canvas shadow-card transition duration-200 ease-out ${
          shown ? "scale-100 opacity-100" : "scale-95 opacity-0"
        }`}
      >
        <div className="flex items-center justify-between border-b border-hairline px-6 py-4">
          <h2 className="text-title-md text-ink">What this place offers</h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-soft hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <X className="size-5" />
          </button>
        </div>
        <ul className="flex-1 overflow-y-auto px-6 py-1">
          {amenities.map((amenity, i) => {
            const Icon = iconFor(amenity);
            return (
              <li
                key={amenity}
                className={`flex items-center gap-4 py-4 ${
                  i < amenities.length - 1 ? "border-b border-hairline-soft" : ""
                }`}
              >
                <Icon className="size-6 shrink-0 text-ink" />
                <span className="text-body-md text-body">{amenity}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>,
    document.body,
  );
}

export function AmenitiesSection({ amenities }: { amenities: string[] }) {
  const [open, setOpen] = useState(false);

  if (amenities.length === 0) return null;

  const preview = amenities.slice(0, PREVIEW_COUNT);
  const hasMore = amenities.length > PREVIEW_COUNT;

  return (
    <section className="flex flex-col gap-5">
      <h2 className="text-display-sm tracking-tight text-ink">What this place offers</h2>

      {/* Clean, borderless preview grid (matches the inline Airbnb treatment). */}
      <ul className="grid grid-cols-1 gap-x-12 gap-y-4 sm:grid-cols-2">
        {preview.map((amenity) => {
          const Icon = iconFor(amenity);
          return (
            <li key={amenity} className="flex items-center gap-4">
              <Icon className="size-6 shrink-0 text-ink" />
              <span className="text-body-md text-body">{amenity}</span>
            </li>
          );
        })}
      </ul>

      {hasMore && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-1 self-start rounded-md border border-ink px-6 py-3 text-button-md font-semibold text-ink transition-[transform,background-color] hover:bg-surface-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.99]"
        >
          Show all {amenities.length} amenities
        </button>
      )}

      {open && <AmenitiesModal amenities={amenities} onClose={() => setOpen(false)} />}
    </section>
  );
}
