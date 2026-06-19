import { BadgeCheck, Building2, DoorOpen, Users } from "lucide-react";

import { Card } from "@/components/ui/card";
import type { DashboardOverview } from "@/lib/supabase/admin-dal";

// Supply side of the marketplace — inventory totals + where it sits, by San Juan area.
type Supply = DashboardOverview["supply"];

function MiniStat({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof Users;
  value: number;
  label: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Icon className="size-4 text-muted" />
      <span className="text-display-sm text-ink">{value}</span>
      <span className="text-caption-sm text-muted">{label}</span>
    </div>
  );
}

export function SupplyPanel({ supply }: { supply: Supply }) {
  const dotPct =
    supply.properties > 0 ? Math.round((supply.dot_accredited / supply.properties) * 100) : 0;
  const maxArea = Math.max(1, ...supply.by_area.map((a) => a.properties));

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex flex-col">
        <h2 className="text-title-md text-ink">Supply &amp; inventory</h2>
        <span className="text-caption-sm text-muted">{dotPct}% DOT-accredited</span>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MiniStat icon={Building2} value={supply.properties} label="Properties" />
        <MiniStat icon={DoorOpen} value={supply.rooms} label="Rooms" />
        <MiniStat icon={Users} value={supply.capacity} label="Guest capacity" />
        <MiniStat icon={BadgeCheck} value={supply.dot_accredited} label="DOT-accredited" />
      </div>

      {supply.by_area.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-hairline pt-4">
          <span className="text-caption-sm text-muted">Properties by area</span>
          {supply.by_area.map((a) => (
            <div key={a.area} className="flex items-center gap-3">
              <span className="w-24 shrink-0 truncate text-caption text-body">{a.area}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-soft">
                <div
                  className="h-full rounded-full bg-luxe/50"
                  style={{ width: `${(a.properties / maxArea) * 100}%` }}
                />
              </div>
              <span className="w-6 shrink-0 text-right text-caption-sm font-medium text-ink">
                {a.properties}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
