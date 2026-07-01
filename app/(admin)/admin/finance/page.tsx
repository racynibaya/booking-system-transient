import { Banknote, Coins, Landmark, Receipt } from "lucide-react";

import { CommissionTrend } from "@/components/admin/commission-trend";
import { FinanceHero } from "@/components/admin/finance-hero";
import { KpiCard } from "@/components/admin/kpi-card";
import { PayoutsTable } from "@/components/admin/payouts-table";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import {
  getFinanceOverview,
  listPayouts,
  requireAdmin,
  type PayoutStatus,
} from "@/lib/supabase/admin-dal";

const peso = (n: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(n);

const STATUS_LABEL: Record<PayoutStatus, string> = {
  clearing: "Clearing",
  payable: "Payable",
  paid: "Paid",
  failed: "Failed",
  refunded: "Refunded",
  clawed_back: "Clawed back",
};

const PAGE_SIZE = 50;

export default async function AdminFinancePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; offset?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const status = sp.status ?? null;
  const offset = Math.max(0, Number.parseInt(sp.offset ?? "0", 10) || 0);

  const [finance, rows] = await Promise.all([
    getFinanceOverview(),
    listPayouts({ status: status ?? undefined, limit: PAGE_SIZE, offset }),
  ]);

  if (!finance) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Finance" description="Couldn&rsquo;t load finance right now." />
      </div>
    );
  }

  const statusEntries = Object.entries(finance.by_status) as [
    PayoutStatus,
    { count: number; owner_payout: number },
  ][];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Finance"
        description="Commission earned and every payout across the platform."
      />

      <FinanceHero finance={finance} />

      {/* Gross flows recorded through the ledger (never held — custody stays with the processor). */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard
          label="Booking value"
          value={peso(finance.gross.stay_value)}
          icon={Landmark}
          accent="blue"
        />
        <KpiCard
          label="Deposits collected"
          value={peso(finance.gross.deposits)}
          icon={Banknote}
          accent="green"
        />
        <KpiCard
          label="Guest service fees"
          value={peso(finance.gross.service_fees)}
          icon={Receipt}
          accent="amber"
        />
        <KpiCard
          label="Processor fees"
          value={peso(finance.gross.paymongo_fees)}
          caption="absorbed"
          icon={Coins}
          accent="coral"
        />
      </div>

      {/* Commission trend + money-by-status. */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <CommissionTrend trend={finance.trend} />
        </div>
        <Card className="flex flex-col gap-4 p-5">
          <h2 className="text-title-md text-ink">Money by status</h2>
          {statusEntries.length === 0 ? (
            <p className="text-body-sm text-muted">No ledger accruals yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {statusEntries.map(([s, v]) => (
                <li
                  key={s}
                  className="flex items-center justify-between gap-3 rounded-md bg-canvas px-3 py-2"
                >
                  <span className="flex flex-col">
                    <span className="text-body-sm font-medium text-ink">{STATUS_LABEL[s]}</span>
                    <span className="text-caption-sm text-muted tabular-nums">
                      {v.count} {v.count === 1 ? "payout" : "payouts"}
                    </span>
                  </span>
                  <span className="text-body-sm text-ink tabular-nums">{peso(v.owner_payout)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <PayoutsTable rows={rows} status={status} limit={PAGE_SIZE} offset={offset} />
    </div>
  );
}
