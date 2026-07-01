import { Card } from "@/components/ui/card";
import type { FinanceOverview } from "@/lib/supabase/admin-dal";

// Weekly commission — a lightweight CSS bar chart in the same idiom as the overview's TrendBars
// (no charting dependency, real ledger figures). Commission is the platform's revenue, so the tone
// leads with the brand sea-green.
const peso = (n: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(n);

const shortPeso = (n: number) =>
  n >= 1000 ? `₱${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : `₱${Math.round(n)}`;

export function CommissionTrend({ trend }: { trend: FinanceOverview["trend"] }) {
  const max = Math.max(1, ...trend.map((t) => t.value));
  const total = trend.reduce((s, t) => s + t.value, 0);

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col">
          <h2 className="text-title-md text-ink">Commission trend</h2>
          <span className="text-caption-sm text-muted">Weekly cut, last 8 weeks</span>
        </div>
        <p className="text-display-sm text-ink tabular-nums">{peso(total)}</p>
      </div>

      <div className="flex h-40 items-end gap-2">
        {trend.map((t) => (
          <div
            key={t.label}
            className="flex-1 rounded-t-md bg-linear-to-t from-primary to-sunset-1 transition-opacity hover:opacity-80"
            style={{ height: `${Math.max(4, (t.value / max) * 100)}%` }}
            title={`${t.label}: ${peso(t.value)}`}
          />
        ))}
      </div>

      <div className="flex gap-2">
        {trend.map((t) => (
          <div key={t.label} className="flex flex-1 flex-col items-center">
            <span className="text-caption-sm text-ink tabular-nums">{shortPeso(t.value)}</span>
            <span className="text-caption-sm text-muted">{t.label}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
