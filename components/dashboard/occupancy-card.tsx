import { DoorOpen } from "lucide-react";

import { IconChip } from "@/components/ui/icon-chip";
import { Card } from "@/components/ui/card";
import { fromDateStr } from "@/lib/dates";
import type { OccupancyNight, OccupancySnapshot } from "@/lib/supabase/dal";

// "How full am I?" — the answer already on screen for "may bakante ba?". A big open-tonight
// number over a 7-night heat strip: each night's fill deepens toward sea-green as it books up,
// so "this week" is glanceable at a color level. Server component (pure display).
const weekday = (d: string) => fromDateStr(d).toLocaleDateString("en-US", { weekday: "short" });

// Booked ratio → cell fill. Empty nights stay near the surface tint; as a night fills, the
// cell mixes toward primary sea-green. Past ~55% booked the fill is dark enough to flip the
// count to light text. Returns inline style + whether the cell reads as "dark".
function heat(n: OccupancyNight) {
  const ratio = n.total > 0 ? (n.total - n.open) / n.total : 0;
  // 6% floor so an empty night still reads as a tinted tile, not bare surface.
  const mix = Math.round((0.06 + ratio * 0.82) * 100);
  return {
    ratio,
    dark: ratio >= 0.55,
    style: {
      backgroundColor: `color-mix(in srgb, var(--color-primary) ${mix}%, var(--color-surface-soft))`,
    },
  };
}

export function OccupancyCard({ snapshot }: { snapshot: OccupancySnapshot }) {
  const { tonightOpen, tonightTotal, nights } = snapshot;
  const bookedTonight = tonightTotal - tonightOpen;
  const pctFull = tonightTotal > 0 ? Math.round((bookedTonight / tonightTotal) * 100) : 0;

  return (
    <Card lift className="flex flex-col gap-4 p-5">
      <div className="flex items-center gap-2.5">
        <IconChip icon={DoorOpen} tone="sea" />
        <h2 className="text-title-md text-ink">How full am I?</h2>
      </div>

      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-caption-sm text-muted">Open tonight</p>
          <p className="mt-0.5 text-ink">
            <span className="font-display text-[2.75rem] leading-none font-bold tracking-tight">
              {tonightOpen}
            </span>
            <span className="ml-1.5 text-body-md text-muted">of {tonightTotal} rooms</span>
          </p>
        </div>
        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-caption-sm font-medium text-primary">
          {pctFull}% full
        </span>
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {nights.map((n, i) => {
          const h = heat(n);
          return (
            <div
              key={n.date}
              style={h.style}
              className={`flex flex-col items-center gap-1 rounded-sm py-2 ${
                i === 0 ? "ring-2 ring-primary/45 ring-offset-1 ring-offset-canvas" : ""
              }`}
            >
              <span className={`text-caption-sm ${h.dark ? "text-on-primary/80" : "text-muted"}`}>
                {weekday(n.date)}
              </span>
              <span
                className={`text-title-sm ${
                  n.open === 0 ? "text-error" : h.dark ? "text-on-primary" : "text-ink"
                }`}
              >
                {n.open}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
