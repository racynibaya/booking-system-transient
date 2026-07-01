import { HandCoins, TrendingUp, Wallet } from "lucide-react";

import type { FinanceOverview } from "@/lib/supabase/admin-dal";

const peso = (n: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(n);

// Finance centerpiece — commission is the platform's real revenue post-D10, so it's the headline.
// Two sub-tiles carry the trailing-30d cut and the money still owed to operators.
export function FinanceHero({ finance }: { finance: FinanceOverview }) {
  const tiles = [
    {
      label: "Last 30 days",
      value: peso(finance.commission.d30),
      icon: TrendingUp,
      chip: "bg-primary/15 text-primary",
      tint: "bg-primary/[0.04]",
    },
    {
      label: "Owner payouts pending",
      value: peso(finance.pending_owner_payout),
      icon: Wallet,
      chip: "bg-warning/20 text-warning",
      tint: "bg-warning/[0.05]",
    },
  ];

  return (
    <section className="overflow-hidden rounded-md border border-hairline shadow-card">
      <div className="flex flex-col gap-1 bg-linear-to-br from-primary/[0.10] via-sunset-1/[0.08] to-luxe/10 p-5 md:p-6">
        <p className="flex items-center gap-1.5 text-caption text-muted">
          <HandCoins className="size-3.5" />
          Commission earned (all-time)
        </p>
        <p className="text-[2.25rem] leading-none font-semibold tracking-tight text-ink tabular-nums md:text-[2.75rem]">
          {peso(finance.commission.total)}
        </p>
        <p className="mt-1 text-caption-sm text-muted">
          {peso(finance.commission.d7)} in the last 7 days
        </p>
      </div>

      <div className="grid grid-cols-2 gap-px border-t border-hairline bg-hairline">
        {tiles.map((t) => {
          const Icon = t.icon;
          return (
            <div key={t.label} className={`flex items-center gap-3 p-4 ${t.tint}`}>
              <span
                className={`flex size-9 shrink-0 items-center justify-center rounded-md ${t.chip}`}
              >
                <Icon className="size-4.5" />
              </span>
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-display-sm text-ink tabular-nums">{t.value}</span>
                <span className="text-caption-sm text-muted">{t.label}</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
