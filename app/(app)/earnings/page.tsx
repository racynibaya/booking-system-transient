import { BadgeCheck, Clock, Coins, Wallet } from "lucide-react";

import { PayoutsTable } from "@/components/earnings/payouts-table";
import { KpiCard, type Accent } from "@/components/admin/kpi-card";
import { PageHeader } from "@/components/ui/page-header";
import { getEarnings, requireUser } from "@/lib/supabase/dal";

const peso = (n: number) => `₱${n.toLocaleString("en-PH")}`;

export default async function EarningsPage() {
  await requireUser();
  const earnings = await getEarnings();

  // Soonest clearing date, for the Clearing tile caption.
  const nextClear = earnings.rows
    .filter((r) => r.status === "clearing" && r.clearEta)
    .map((r) => r.clearEta as string)
    .sort()[0];
  const nextClearLabel = nextClear
    ? `Next on ${new Date(nextClear).toLocaleDateString("en-PH", { month: "short", day: "numeric" })}`
    : undefined;

  const tiles: {
    label: string;
    value: string;
    caption?: string;
    icon: typeof Coins;
    accent: Accent;
  }[] = [
    {
      label: "Clearing",
      value: peso(earnings.clearing),
      caption: nextClearLabel ?? "On the way",
      icon: Clock,
      accent: "amber",
    },
    {
      label: "Payable",
      value: peso(earnings.payable),
      caption: "Ready for payout",
      icon: Wallet,
      accent: "blue",
    },
    {
      label: "Paid out",
      value: peso(earnings.paid),
      caption: "Total disbursed",
      icon: BadgeCheck,
      accent: "green",
    },
  ];
  if (earnings.onHold > 0) {
    tiles.push({
      label: "On hold",
      value: peso(earnings.onHold),
      caption: "Refunded / held",
      icon: Coins,
      accent: "purple",
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Earnings"
        description="Your share of each online booking — what's clearing, what's ready, and what's been paid out. Online deposits land in the Tuloy wallet and are sent to your payout account once they clear (about 2 banking days)."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <KpiCard
            key={t.label}
            label={t.label}
            value={t.value}
            caption={t.caption}
            icon={t.icon}
            accent={t.accent}
          />
        ))}
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-display-sm text-ink">Payouts</h2>
        <PayoutsTable rows={earnings.rows} />
      </section>
    </div>
  );
}
