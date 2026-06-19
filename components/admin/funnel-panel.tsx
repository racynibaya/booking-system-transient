import { Card } from "@/components/ui/card";
import type { DashboardOverview } from "@/lib/supabase/admin-dal";

// Booking funnel + conversion. Aggregate distribution of every booking by status, plus the three
// rates that matter for platform health. No row-level records.
type Bookings = DashboardOverview["bookings"];

const SEGMENTS: { key: keyof Bookings; label: string; bar: string; dot: string }[] = [
  { key: "held", label: "Held", bar: "bg-surface-strong", dot: "bg-border-strong" },
  { key: "awaiting", label: "Awaiting", bar: "bg-warning/70", dot: "bg-warning" },
  { key: "confirmed", label: "Confirmed", bar: "bg-success/80", dot: "bg-success" },
  { key: "completed", label: "Completed", bar: "bg-success", dot: "bg-success" },
  { key: "cancelled", label: "Cancelled", bar: "bg-error/70", dot: "bg-error" },
  { key: "expired", label: "Expired", bar: "bg-muted-soft", dot: "bg-muted-soft" },
  { key: "no_show", label: "No-show", bar: "bg-error", dot: "bg-error" },
];

function Rate({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="flex flex-col">
      <span className={`text-display-sm ${tone}`}>{value}%</span>
      <span className="text-caption-sm text-muted">{label}</span>
    </div>
  );
}

export function FunnelPanel({ bookings }: { bookings: Bookings }) {
  const total = Math.max(1, bookings.total);
  const visible = SEGMENTS.filter((s) => bookings[s.key] > 0);

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex flex-col">
        <h2 className="text-title-md text-ink">Booking funnel</h2>
        <span className="text-caption-sm text-muted">{bookings.total} bookings all-time</span>
      </div>

      {/* Stacked distribution bar. */}
      <div className="flex h-3 overflow-hidden rounded-full bg-surface-soft">
        {visible.map((s) => (
          <div
            key={s.key}
            className={s.bar}
            style={{ width: `${(bookings[s.key] / total) * 100}%` }}
            title={`${s.label}: ${bookings[s.key]}`}
          />
        ))}
      </div>

      {/* Legend with counts. */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
        {visible.map((s) => (
          <div key={s.key} className="flex items-center gap-2">
            <span className={`size-2 shrink-0 rounded-full ${s.dot}`} />
            <span className="text-caption-sm text-muted">{s.label}</span>
            <span className="ml-auto text-caption-sm font-medium text-ink">{bookings[s.key]}</span>
          </div>
        ))}
      </div>

      {/* The three health rates. */}
      <div className="grid grid-cols-3 gap-3 border-t border-hairline pt-4">
        <Rate label="Confirmation" value={bookings.confirmation_rate} tone="text-success" />
        <Rate label="Cancellation" value={bookings.cancellation_rate} tone="text-warning" />
        <Rate label="No-show" value={bookings.no_show_rate} tone="text-error" />
      </div>
    </Card>
  );
}
