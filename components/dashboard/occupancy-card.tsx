import { DoorOpen } from "lucide-react";

import { Card } from "@/components/ui/card";
import { fromDateStr } from "@/lib/dates";
import type { OccupancySnapshot } from "@/lib/supabase/dal";

// "How full am I?" — the answer already on screen for "may bakante ba?". A big open-tonight
// number over a 7-night strip so "this week" is glanceable. Server component (pure display).
const weekday = (d: string) => fromDateStr(d).toLocaleDateString("en-US", { weekday: "short" });

export function OccupancyCard({ snapshot }: { snapshot: OccupancySnapshot }) {
  const { tonightOpen, tonightTotal, nights } = snapshot;

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex items-center gap-2.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-surface-soft text-primary">
          <DoorOpen className="size-4.5" />
        </span>
        <h2 className="text-title-md text-ink">How full am I?</h2>
      </div>

      <div>
        <p className="text-caption-sm text-muted">Open tonight</p>
        <p className="mt-0.5 text-ink">
          <span className="font-display text-display-xl leading-none">{tonightOpen}</span>
          <span className="ml-1.5 text-body-md text-muted">of {tonightTotal} rooms</span>
        </p>
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {nights.map((n, i) => (
          <div
            key={n.date}
            className={`flex flex-col items-center gap-1 rounded-sm py-2 ${
              i === 0 ? "bg-primary-disabled" : "bg-surface-soft"
            }`}
          >
            <span className="text-caption-sm text-muted">{weekday(n.date)}</span>
            <span className={`text-title-sm ${n.open === 0 ? "text-error" : "text-ink"}`}>
              {n.open}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}
