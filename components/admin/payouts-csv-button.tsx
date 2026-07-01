"use client";

import { Download } from "lucide-react";

import { buttonClassName } from "@/components/ui/button";
import type { PayoutRow } from "@/lib/supabase/admin-dal";

// Client-side CSV of the currently-shown payout rows. Exports what's on screen (the active filter +
// page) — a deliberate, dependency-free "grab this view" rather than a full-ledger export.
const HEADERS = [
  "created_at",
  "operator",
  "guest",
  "property",
  "stay_value",
  "deposit",
  "commission",
  "owner_payout",
  "status",
  "clear_eta",
];

function toCsv(rows: PayoutRow[]): string {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = [HEADERS.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.created_at,
        r.operator_name,
        r.guest_name,
        r.property_name,
        r.stay_value,
        r.deposit_amount,
        r.operator_commission,
        r.owner_payout,
        r.status,
        r.clear_eta,
      ]
        .map(esc)
        .join(","),
    );
  }
  return lines.join("\n");
}

export function PayoutsCsvButton({ rows }: { rows: PayoutRow[] }) {
  function download() {
    const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payouts-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      type="button"
      onClick={download}
      disabled={rows.length === 0}
      className={buttonClassName({ variant: "secondary", size: "sm" })}
    >
      <Download className="size-3.5" />
      Export CSV
    </button>
  );
}
