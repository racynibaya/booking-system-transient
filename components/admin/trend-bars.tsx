import { Card } from "@/components/ui/card";
import type { DashboardOverview } from "@/lib/supabase/admin-dal";

// Revenue + booking-volume trend, last 6 weeks. A lightweight CSS bar chart — real weekly GMV from
// the overview RPC, no charting dependency, no interpolated/fake points.
const peso = (n: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(n);

const shortPeso = (n: number) =>
  n >= 1000 ? `₱${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : `₱${n}`;

const weekLabel = (iso: string) =>
  new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric" }).format(new Date(iso));

export function TrendBars({ trend }: { trend: DashboardOverview["trend"] }) {
  const max = Math.max(1, ...trend.map((t) => t.gmv));
  const totalGmv = trend.reduce((s, t) => s + t.gmv, 0);
  const totalBookings = trend.reduce((s, t) => s + t.bookings, 0);

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col">
          <h2 className="text-title-md text-ink">Revenue trend</h2>
          <span className="text-caption-sm text-muted">Confirmed GMV, last 6 weeks</span>
        </div>
        <div className="text-right">
          <p className="text-display-sm text-ink">{peso(totalGmv)}</p>
          <p className="text-caption-sm text-muted">{totalBookings} bookings booked</p>
        </div>
      </div>

      <div className="flex h-40 items-end gap-2">
        {trend.map((t) => (
          <div
            key={t.week_start}
            className="group flex-1 rounded-t-md bg-linear-to-t from-primary to-sunset-1 transition-opacity hover:opacity-80"
            style={{ height: `${Math.max(4, (t.gmv / max) * 100)}%` }}
            title={`Week of ${weekLabel(t.week_start)}: ${peso(t.gmv)} · ${t.bookings} bookings`}
          />
        ))}
      </div>

      <div className="flex gap-2">
        {trend.map((t) => (
          <div key={t.week_start} className="flex flex-1 flex-col items-center">
            <span className="text-caption-sm text-ink">{shortPeso(t.gmv)}</span>
            <span className="text-caption-sm text-muted">{weekLabel(t.week_start)}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
