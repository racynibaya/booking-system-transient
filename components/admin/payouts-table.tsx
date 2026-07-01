import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import type { PayoutRow, PayoutStatus } from "@/lib/supabase/admin-dal";

import { PayoutsCsvButton } from "./payouts-csv-button";

const peso = (n: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(n);

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-PH", { month: "short", day: "numeric" });

// Ledger lifecycle → Badge tone + human label. Green = disbursed, amber = needs a payout run,
// red = broken, muted/neutral = in-flight or terminal-neutral.
const STATUS: Record<
  PayoutStatus,
  { tone: "success" | "warning" | "danger" | "muted" | "neutral"; label: string }
> = {
  clearing: { tone: "muted", label: "Clearing" },
  payable: { tone: "warning", label: "Payable" },
  paid: { tone: "success", label: "Paid" },
  failed: { tone: "danger", label: "Failed" },
  refunded: { tone: "neutral", label: "Refunded" },
  clawed_back: { tone: "danger", label: "Clawed back" },
};

const FILTERS: { label: string; value: string | null }[] = [
  { label: "All", value: null },
  { label: "Clearing", value: "clearing" },
  { label: "Payable", value: "payable" },
  { label: "Paid", value: "paid" },
  { label: "Failed", value: "failed" },
  { label: "Refunded", value: "refunded" },
  { label: "Clawed back", value: "clawed_back" },
];

function hrefFor(status: string | null, offset: number) {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (offset > 0) params.set("offset", String(offset));
  const qs = params.toString();
  return qs ? `/admin/finance?${qs}` : "/admin/finance";
}

export function PayoutsTable({
  rows,
  status,
  limit,
  offset,
}: {
  rows: PayoutRow[];
  status: string | null;
  limit: number;
  offset: number;
}) {
  const total = rows[0]?.total_count ?? 0;
  const hasPrev = offset > 0;
  const hasNext = offset + limit < total;
  const rangeEnd = Math.min(offset + rows.length, total);

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-title-md text-ink">Payout ledger</h2>
        <PayoutsCsvButton rows={rows} />
      </div>

      {/* Status filters — always present per the data-dense-dashboard rule. */}
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => {
          const active = (f.value ?? null) === status;
          return (
            <Link
              key={f.label}
              href={hrefFor(f.value, 0)}
              className={`rounded-full px-3 py-1 text-caption-sm transition-colors ${
                active
                  ? "bg-primary text-on-primary"
                  : "border border-hairline text-muted hover:border-border-strong hover:text-ink"
              }`}
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No payouts yet"
          description="Ledger accruals appear here as centralized bookings confirm."
        />
      ) : (
        <>
          <div className="-mx-5 overflow-x-auto px-5">
            <table className="w-full min-w-[720px] text-left text-caption">
              <thead>
                <tr className="border-b border-hairline text-caption-sm text-muted">
                  <th className="py-2 pr-4 font-medium">Date</th>
                  <th className="py-2 pr-4 font-medium">Operator</th>
                  <th className="py-2 pr-4 font-medium">Guest / property</th>
                  <th className="py-2 pr-4 text-right font-medium">Stay</th>
                  <th className="py-2 pr-4 text-right font-medium">Commission</th>
                  <th className="py-2 pr-4 text-right font-medium">Owner payout</th>
                  <th className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const s = STATUS[r.status];
                  return (
                    <tr key={r.id} className="border-b border-hairline-soft last:border-b-0">
                      <td className="py-2.5 pr-4 whitespace-nowrap text-muted tabular-nums">
                        {shortDate(r.created_at)}
                      </td>
                      <td className="py-2.5 pr-4 font-medium text-ink">{r.operator_name}</td>
                      <td className="max-w-[200px] truncate py-2.5 pr-4 text-body">
                        {r.guest_name} · {r.property_name}
                      </td>
                      <td className="py-2.5 pr-4 text-right text-body tabular-nums">
                        {peso(r.stay_value)}
                      </td>
                      <td className="py-2.5 pr-4 text-right font-medium text-primary tabular-nums">
                        {peso(r.operator_commission)}
                      </td>
                      <td className="py-2.5 pr-4 text-right text-body tabular-nums">
                        {peso(r.owner_payout)}
                      </td>
                      <td className="py-2.5">
                        <Badge tone={s.tone}>{s.label}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination. */}
          <div className="flex items-center justify-between gap-3 text-caption-sm text-muted">
            <span className="tabular-nums">
              {offset + 1}–{rangeEnd} of {total}
            </span>
            <span className="flex gap-2">
              <Link
                href={hrefFor(status, Math.max(0, offset - limit))}
                aria-disabled={!hasPrev}
                className={`rounded-sm border border-hairline px-3 py-1 transition-colors ${
                  hasPrev ? "text-ink hover:border-border-strong" : "pointer-events-none opacity-40"
                }`}
              >
                Prev
              </Link>
              <Link
                href={hrefFor(status, offset + limit)}
                aria-disabled={!hasNext}
                className={`rounded-sm border border-hairline px-3 py-1 transition-colors ${
                  hasNext ? "text-ink hover:border-border-strong" : "pointer-events-none opacity-40"
                }`}
              >
                Next
              </Link>
            </span>
          </div>
        </>
      )}
    </Card>
  );
}
