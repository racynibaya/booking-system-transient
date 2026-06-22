import { Card } from "@/components/ui/card";
import type { BillingHealth } from "@/lib/supabase/admin-dal";

// Subscription billing health: paying / renewing soon / past due, plus the names to chase. The
// in-app replacement for tracking subscriptions in someone's head — a lapse shows up here.
function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-PH", { month: "short", day: "numeric" });
}

export function BillingPanel({ billing }: { billing: BillingHealth }) {
  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex flex-col">
        <h2 className="text-title-md text-ink">Subscriptions</h2>
        <span className="text-caption-sm text-muted">Who&rsquo;s paying — and who lapsed</span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col">
          <span className="text-display-sm text-success">{billing.paying}</span>
          <span className="text-caption-sm text-muted">Paying</span>
        </div>
        <div className="flex flex-col">
          <span className="text-display-sm text-warning">{billing.due_soon}</span>
          <span className="text-caption-sm text-muted">Due soon</span>
        </div>
        <div className="flex flex-col">
          <span className={`text-display-sm ${billing.past_due > 0 ? "text-error" : "text-ink"}`}>
            {billing.past_due}
          </span>
          <span className="text-caption-sm text-muted">Past due</span>
        </div>
      </div>

      {billing.overdue_list.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-hairline pt-4">
          <span className="text-caption-sm text-muted">Overdue — needs a nudge</span>
          {billing.overdue_list.map((t, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="size-2 shrink-0 rounded-full bg-error" />
              <span className="truncate text-caption-sm text-ink">{t.name ?? "Unnamed"}</span>
              <span className="ml-auto text-caption-sm text-muted">
                {t.plan} · lapsed {formatDate(t.paid_until)}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
