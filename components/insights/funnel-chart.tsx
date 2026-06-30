import { Filter } from "lucide-react";

import { Card } from "@/components/ui/card";
import { IconChip } from "@/components/ui/icon-chip";
import type { FunnelStage } from "@/lib/supabase/dal";

import { DataTable } from "./data-table";

// Inquiry → booking funnel as PERIOD TOTALS over the window — not per-inquiry attribution
// (inquiry threads carry no booking link, so we can't say which inquiry produced which booking).
// Each stage is a horizontal bar scaled to the top of the funnel; the step-down conversion vs the
// previous stage rides on the right. The copy is explicit that these are counts, not a tracked cohort.
export function FunnelChart({ stages, days }: { stages: FunnelStage[]; days: number }) {
  // Bars scale to the largest stage, not the top one — these are independent counts, so a later
  // stage can exceed an earlier one (most bookings are direct, not from inquiries).
  const top = Math.max(1, ...stages.map((s) => s.count));

  return (
    <Card elevation={1} className="flex flex-col gap-4 p-5">
      <div className="flex items-center gap-2.5">
        <IconChip icon={Filter} tone="sea" />
        <div className="min-w-0">
          <h2 className="text-title-md text-ink">Inquiry → booking</h2>
          <p className="text-caption-sm text-muted">Totals over the last {days} days</p>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {stages.map((s, i) => {
          const width = Math.max(s.count > 0 ? 6 : 0, Math.round((s.count / top) * 100));
          const prev = i > 0 ? stages[i - 1] : null;
          // Only a genuine drop is a meaningful rate; suppress it where a later stage exceeds the
          // earlier one (cross-population, not a conversion).
          const conv =
            prev && prev.count > 0 && s.count <= prev.count
              ? Math.round((s.count / prev.count) * 100)
              : null;
          return (
            <div key={s.label} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between text-caption-sm">
                <span className="text-muted">{s.label}</span>
                <span className="text-ink">
                  <span className="text-title-sm">{s.count}</span>
                  {conv !== null && (
                    <span className="ml-1.5 text-muted">
                      {conv}% of {prev!.label.toLowerCase()}
                    </span>
                  )}
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-soft">
                <div className="h-full rounded-full bg-primary/85" style={{ width: `${width}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-caption-sm text-muted">
        Period totals, not a tracked cohort — inquiries and bookings are counted independently.
      </p>

      <DataTable headers={["Stage", "Count"]} rows={stages.map((s) => [s.label, s.count])} />
    </Card>
  );
}
