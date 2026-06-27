"use client";

import { format } from "date-fns";
import { ChevronDown, Coins } from "lucide-react";
import { useState, type ComponentProps } from "react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { fromDateStr } from "@/lib/dates";
import type { PayoutRow, PayoutStatus } from "@/lib/supabase/dal";

function peso(amount: number | null) {
  return amount == null ? "—" : `₱${amount.toLocaleString("en-PH")}`;
}

function dayDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function stayRange(checkIn: string | null, checkOut: string | null) {
  if (!checkIn || !checkOut) return "—";
  return `${format(fromDateStr(checkIn), "MMM d")} – ${format(fromDateStr(checkOut), "MMM d")}`;
}

const STATUS_META: Record<
  PayoutStatus,
  { label: string; tone: ComponentProps<typeof Badge>["tone"] }
> = {
  clearing: { label: "Clearing", tone: "warning" },
  payable: { label: "Payable", tone: "accent" },
  paid: { label: "Paid out", tone: "success" },
  failed: { label: "Failed", tone: "danger" },
  refunding: { label: "Refunding", tone: "warning" },
  refunded: { label: "Refunded", tone: "muted" },
  clawed_back: { label: "Clawed back", tone: "muted" },
};

// The "When" cell: what the operator wants to know per status — when it clears, when it paid.
function whenLabel(r: PayoutRow): string {
  switch (r.status) {
    case "clearing":
      return r.clearEta ? `Clears ${dayDate(r.clearEta)}` : "Clearing";
    case "payable":
      return "Awaiting payout";
    case "paid":
      return r.payoutRef ? `Paid · ${r.payoutRef}` : "Paid";
    case "refunded":
    case "clawed_back":
      return r.refundAmount != null ? `Refunded ${peso(r.refundAmount)}` : "Refunded";
    case "refunding":
      return "Refund in progress";
    case "failed":
      return "Transfer failed";
  }
}

function SplitDetail({ r }: { r: PayoutRow }) {
  const line = (label: string, value: string) => (
    <div className="flex items-center justify-between gap-4 py-1">
      <span className="text-caption text-muted">{label}</span>
      <span className="text-caption-sm text-body tabular-nums">{value}</span>
    </div>
  );
  return (
    <div className="rounded-sm border border-hairline bg-surface-soft p-3">
      {line("Stay value", peso(r.stayValue))}
      {line("Deposit collected", peso(r.depositAmount))}
      {line("Commission withheld", `− ${peso(r.operatorCommission)}`)}
      {line("Guest service fee", peso(r.guestServiceFee))}
      <div className="mt-1 flex items-center justify-between gap-4 border-t border-hairline pt-2">
        <span className="text-caption font-medium text-ink">Your payout</span>
        <span className="text-body-sm font-semibold text-ink tabular-nums">
          {peso(r.ownerPayout)}
        </span>
      </div>
    </div>
  );
}

export function PayoutsTable({ rows }: { rows: PayoutRow[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Coins}
        title="No payouts yet"
        description="When a guest pays online, your share shows up here — clearing, then paid out."
      />
    );
  }

  return (
    <>
      {/* Desktop: table. */}
      <div className="hidden overflow-hidden rounded-md border border-hairline md:block">
        <table className="w-full text-left">
          <thead className="border-b border-hairline bg-surface-soft">
            <tr className="text-caption text-muted">
              <th className="px-4 py-2.5 font-medium">Booking</th>
              <th className="px-4 py-2.5 text-right font-medium">Your payout</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium">When</th>
              <th className="w-10 px-4 py-2.5" aria-hidden />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const open = expanded.has(r.id);
              const meta = STATUS_META[r.status];
              return (
                <tr
                  key={r.id}
                  className="cursor-pointer border-b border-hairline align-top transition-colors last:border-0 hover:bg-surface-soft"
                  onClick={() => toggle(r.id)}
                >
                  <td className="px-4 py-3">
                    <p className="text-body-sm font-medium text-ink">{r.guestName ?? "Guest"}</p>
                    <p className="text-caption-sm text-muted">
                      {r.propertyName ? `${r.propertyName} · ` : ""}
                      {stayRange(r.checkIn, r.checkOut)}
                    </p>
                    {open && (
                      <div className="mt-2 max-w-sm">
                        <SplitDetail r={r} />
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-body-sm font-semibold text-ink tabular-nums">
                    {peso(r.ownerPayout)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={meta.tone}>{meta.label}</Badge>
                  </td>
                  <td className="px-4 py-3 text-caption-sm text-muted">{whenLabel(r)}</td>
                  <td className="px-4 py-3 text-right">
                    <ChevronDown
                      className={`inline size-4 text-muted-soft transition-transform ${open ? "rotate-180" : ""}`}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile: stacked cards. */}
      <div className="flex flex-col gap-3 md:hidden">
        {rows.map((r) => {
          const open = expanded.has(r.id);
          const meta = STATUS_META[r.status];
          return (
            <Card key={r.id} className="p-4">
              <button
                type="button"
                aria-expanded={open}
                onClick={() => toggle(r.id)}
                className="flex w-full items-start justify-between gap-3 text-left"
              >
                <div className="min-w-0">
                  <p className="truncate text-body-sm font-medium text-ink">
                    {r.guestName ?? "Guest"}
                  </p>
                  <p className="truncate text-caption-sm text-muted">
                    {r.propertyName ? `${r.propertyName} · ` : ""}
                    {stayRange(r.checkIn, r.checkOut)}
                  </p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <Badge tone={meta.tone}>{meta.label}</Badge>
                    <span className="text-caption-sm text-muted">{whenLabel(r)}</span>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-body-sm font-semibold text-ink tabular-nums">
                    {peso(r.ownerPayout)}
                  </span>
                  <ChevronDown
                    className={`size-4 text-muted-soft transition-transform ${open ? "rotate-180" : ""}`}
                  />
                </div>
              </button>
              {open && (
                <div className="mt-3">
                  <SplitDetail r={r} />
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </>
  );
}
