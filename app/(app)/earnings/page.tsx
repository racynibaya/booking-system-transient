import { ChevronRight, Receipt, TrendingUp, Wallet } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { IconChip } from "@/components/ui/icon-chip";
import { PageHeader } from "@/components/ui/page-header";
import { STATUS_LABELS } from "@/lib/bookings";
import { formatDateShort } from "@/lib/dates";
import { getEarnings, requireUser } from "@/lib/supabase/dal";

const peso = (n: number) => `₱${n.toLocaleString("en-PH")}`;

function Stat({
  icon,
  label,
  value,
  tone = "sea",
}: {
  icon: typeof Wallet;
  label: string;
  value: string;
  tone?: "sea" | "success" | "warning";
}) {
  return (
    <Card elevation={1} className="flex flex-col gap-2 p-4">
      <IconChip icon={icon} tone={tone} size="sm" />
      <div>
        <p className="text-caption-sm text-muted">{label}</p>
        <p className="text-display-sm text-ink">{value}</p>
      </div>
    </Card>
  );
}

function Figure({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "warning" | "success";
}) {
  return (
    <div className="text-right">
      <p className="text-caption-sm text-muted">{label}</p>
      <p
        className={`text-title-sm ${tone === "warning" ? "text-warning" : tone === "success" ? "text-success" : "text-ink"}`}
      >
        {value}
      </p>
    </div>
  );
}

// M4 — the operator's single financial source of truth. The cash/deposit half is live: real
// bookings, what's collected, Tuloy's 2.5% commission, the net, and outstanding balances. Online
// card/e-wallet settlements join once that rail clears.
export default async function EarningsPage() {
  await requireUser();
  const e = await getEarnings();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Earnings"
        description="What your bookings are worth, Tuloy's commission, and what's still owed."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={Wallet} label="Booking value" value={peso(e.gross)} />
        <Stat icon={TrendingUp} label="Net to you" value={peso(e.net)} tone="success" />
        <Stat icon={Receipt} label="Tuloy commission (2.5%)" value={peso(e.commission)} />
        <Stat icon={Wallet} label="Outstanding" value={peso(e.outstanding)} tone="warning" />
      </div>

      <div className="flex items-start gap-2.5 rounded-md bg-sea/8 p-4">
        <Receipt className="mt-0.5 size-4 shrink-0 text-sea" />
        <p className="text-body-sm text-body">
          This is the cash &amp; GCash-deposit ledger. Online card/e-wallet payments will appear
          here once you activate online payments in Settings.
        </p>
      </div>

      {e.rows.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="No earnings yet"
          description="Confirmed bookings and what you've collected will show up here."
        />
      ) : (
        <Card elevation={1} className="flex flex-col divide-y divide-hairline-soft p-0">
          {e.rows.map((r) => (
            <Link
              key={r.id}
              href={`/bookings/${r.id}`}
              className="group flex flex-col gap-3 p-4 transition-colors first:rounded-t-md last:rounded-b-md hover:bg-surface-soft/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 items-center gap-2">
                <div className="min-w-0">
                  <p className="truncate text-title-sm text-ink">{r.guestName}</p>
                  <p className="truncate text-caption-sm text-muted">
                    {formatDateShort(r.checkIn)} → {formatDateShort(r.checkOut)}
                  </p>
                </div>
                <Badge tone={r.status === "completed" ? "neutral" : "success"}>
                  {STATUS_LABELS[r.status]}
                </Badge>
              </div>
              <div className="flex items-center gap-5">
                <Figure label="Total" value={peso(r.total)} />
                <Figure label="Net" value={peso(r.net)} tone="success" />
                <Figure
                  label="Balance"
                  value={r.balance > 0 ? peso(r.balance) : "Paid"}
                  tone={r.balance > 0 ? "warning" : "success"}
                />
                <ChevronRight className="hidden size-5 shrink-0 text-muted-soft transition-transform group-hover:translate-x-0.5 sm:block" />
              </div>
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}
