import { CalendarClock } from "lucide-react";

import { Card } from "@/components/ui/card";
import { IconChip } from "@/components/ui/icon-chip";
import type { LeadTimeBucket } from "@/lib/supabase/dal";

import { DataTable } from "./data-table";

// How far ahead guests book: a horizontal histogram of (check-in − booking date) over confirmed
// stays. Tells the operator whether demand is last-minute or planned — informs how long to hold
// inventory and when to nudge. Walk-ins booked on/after arrival land in the 0–1d bar.
export function LeadTimeChart({ buckets }: { buckets: LeadTimeBucket[] }) {
  const max = Math.max(1, ...buckets.map((b) => b.count));

  return (
    <Card elevation={1} className="flex flex-col gap-4 p-5">
      <div className="flex items-center gap-2.5">
        <IconChip icon={CalendarClock} tone="sea" />
        <div className="min-w-0">
          <h2 className="text-title-md text-ink">Booking lead time</h2>
          <p className="text-caption-sm text-muted">Days from booking to check-in</p>
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        {buckets.map((b) => (
          <div key={b.label} className="flex items-center gap-3">
            <span className="w-12 shrink-0 text-caption-sm text-muted">{b.label}</span>
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-soft">
              <div
                className="h-full rounded-full bg-sea/85"
                style={{
                  width: `${Math.max(b.count > 0 ? 4 : 0, Math.round((b.count / max) * 100))}%`,
                }}
              />
            </div>
            <span className="w-6 shrink-0 text-right text-caption-sm text-ink">{b.count}</span>
          </div>
        ))}
      </div>

      <DataTable
        headers={["Lead time", "Bookings"]}
        rows={buckets.map((b) => [b.label, b.count])}
      />
    </Card>
  );
}
