"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ComponentProps } from "react";

import { RefundDetail } from "@/components/admin/refund-detail";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { AdminOnlinePayout } from "@/lib/supabase/admin-dal";

const peso = (n: number) => `₱${n.toLocaleString("en-PH")}`;

const STATUS_TONE: Record<string, ComponentProps<typeof Badge>["tone"]> = {
  clearing: "warning",
  payable: "accent",
  paid: "success",
  refunding: "warning",
  refunded: "muted",
  clawed_back: "muted",
  failed: "danger",
};

function dayDate(s: string) {
  return new Date(s).toLocaleDateString("en-PH", { month: "short", day: "numeric" });
}

export function RefundsPanel({ recent }: { recent: AdminOnlinePayout[] }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [manualId, setManualId] = useState("");
  const router = useRouter();

  const onRefunded = () => router.refresh(); // re-pull the recent list so statuses update

  return (
    <div className="flex flex-col gap-6">
      {/* The selected booking's refund detail (from a row or the manual lookup). */}
      {selected && (
        <RefundDetail
          key={selected}
          bookingId={selected}
          onRefunded={onRefunded}
          onClose={() => setSelected(null)}
        />
      )}

      {/* Recent online payments — refund straight from a row. */}
      <section className="flex flex-col gap-3">
        <h2 className="text-display-sm text-ink">Recent online payments</h2>
        {recent.length === 0 ? (
          <p className="text-body-sm text-muted">No online payments yet.</p>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-hidden rounded-md border border-hairline md:block">
              <table className="w-full text-left">
                <thead className="border-b border-hairline bg-surface-soft text-caption text-muted">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Guest</th>
                    <th className="px-4 py-2.5 font-medium">Operator</th>
                    <th className="px-4 py-2.5 text-right font-medium">Deposit</th>
                    <th className="px-4 py-2.5 font-medium">Status</th>
                    <th className="px-4 py-2.5 font-medium">Paid</th>
                    <th className="w-24 px-4 py-2.5" aria-hidden />
                  </tr>
                </thead>
                <tbody>
                  {recent.map((r) => (
                    <tr key={r.bookingId} className="border-b border-hairline last:border-0">
                      <td className="px-4 py-3">
                        <p className="text-body-sm font-medium text-ink">
                          {r.guestName ?? "Guest"}
                        </p>
                        {r.propertyName && (
                          <p className="text-caption-sm text-muted">{r.propertyName}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-body-sm text-body">{r.operatorName ?? "—"}</td>
                      <td className="px-4 py-3 text-right text-body-sm text-ink tabular-nums">
                        {peso(r.depositAmount)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={STATUS_TONE[r.status] ?? "neutral"}>
                          {r.status.replace("_", " ")}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-caption-sm text-muted">
                        {dayDate(r.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => setSelected(r.bookingId)}
                        >
                          Refund
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="flex flex-col gap-3 md:hidden">
              {recent.map((r) => (
                <Card key={r.bookingId} className="flex items-start justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="truncate text-body-sm font-medium text-ink">
                      {r.guestName ?? "Guest"}
                    </p>
                    <p className="truncate text-caption-sm text-muted">
                      {r.propertyName ? `${r.propertyName} · ` : ""}
                      {r.operatorName ?? "—"}
                    </p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <Badge tone={STATUS_TONE[r.status] ?? "neutral"}>
                        {r.status.replace("_", " ")}
                      </Badge>
                      <span className="text-caption-sm text-muted tabular-nums">
                        {peso(r.depositAmount)}
                      </span>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setSelected(r.bookingId)}
                  >
                    Refund
                  </Button>
                </Card>
              ))}
            </div>
          </>
        )}
      </section>

      {/* Fallback: look up any booking by ID (e.g. from PayMongo metadata). */}
      <section className="flex flex-col gap-2">
        <h2 className="text-title-md text-ink">Look up by booking ID</h2>
        <div className="flex items-end gap-2">
          <Input
            value={manualId}
            onChange={(e) => setManualId(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && manualId.trim() && setSelected(manualId.trim())}
            placeholder="00000000-0000-0000-0000-000000000000"
            autoComplete="off"
            className="max-w-md"
          />
          <Button
            type="button"
            onClick={() => manualId.trim() && setSelected(manualId.trim())}
            disabled={!manualId.trim()}
          >
            <Search className="size-4" /> Look up
          </Button>
        </div>
      </section>
    </div>
  );
}
