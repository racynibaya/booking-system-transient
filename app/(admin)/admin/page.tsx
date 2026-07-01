import {
  CalendarCheck,
  CircleDashed,
  Coins,
  HandCoins,
  Hourglass,
  Receipt,
  Wallet,
} from "lucide-react";

import { ActionCenter } from "@/components/admin/action-center";
import { ActivityFeed } from "@/components/admin/activity-feed";
import { DashboardGreeting } from "@/components/admin/dashboard-greeting";
import { FunnelPanel } from "@/components/admin/funnel-panel";
import { KpiCard } from "@/components/admin/kpi-card";
import { RevenueHero } from "@/components/admin/revenue-hero";
import { SupplyPanel } from "@/components/admin/supply-panel";
import { TrendBars } from "@/components/admin/trend-bars";
import { UpcomingPanel } from "@/components/admin/upcoming-panel";
import {
  getActionCenter,
  getActivityFeed,
  getDashboardOverview,
  requireAdmin,
} from "@/lib/supabase/admin-dal";

const peso = (n: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(n);

export default async function AdminOverviewPage() {
  const tenant = await requireAdmin();
  const [overview, actionCenter, activity] = await Promise.all([
    getDashboardOverview(),
    getActionCenter(),
    getActivityFeed(),
  ]);

  if (!overview) {
    return (
      <div className="flex flex-col gap-6">
        <DashboardGreeting name={tenant.name} />
        <p className="text-body-sm text-muted">Couldn&rsquo;t load the dashboard right now.</p>
      </div>
    );
  }

  const { financials, operators, bookings, trend, supply, upcoming, finance } = overview;

  return (
    <div className="flex flex-col gap-6">
      <DashboardGreeting name={tenant.name} />

      {/* Financials + operator funnel. */}
      <RevenueHero
        gmvFormatted={peso(financials.gmv)}
        confirmedCount={bookings.confirmed}
        operators={operators}
      />

      {/* Commission / payout money — the real revenue post-D10. */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard
          label="Commission earned"
          value={peso(finance.commission_total)}
          caption={`${peso(finance.commission_30d)} last 30d`}
          icon={HandCoins}
          accent="green"
        />
        <KpiCard
          label="Owner payouts pending"
          value={peso(finance.owner_payout_pending)}
          caption={`${finance.payouts.clearing + finance.payouts.payable} accruing`}
          icon={Wallet}
          accent="amber"
        />
        <KpiCard
          label="Payouts paid"
          value={finance.payouts.paid}
          caption={finance.payouts.failed > 0 ? `${finance.payouts.failed} failed` : "none failed"}
          icon={Coins}
          accent="blue"
        />
        <KpiCard
          label="Payouts clearing"
          value={finance.payouts.clearing}
          caption="funds in flight"
          icon={CircleDashed}
          accent="purple"
        />
      </div>

      {/* Headline booking money KPIs. */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard
          label="Deposits collected"
          value={peso(financials.deposits)}
          icon={Coins}
          accent="green"
        />
        <KpiCard
          label="Pipeline (awaiting)"
          value={peso(financials.pipeline)}
          icon={Hourglass}
          accent="amber"
        />
        <KpiCard
          label="Avg booking value"
          value={peso(financials.avg_booking)}
          icon={Receipt}
          accent="coral"
        />
        <KpiCard label="Total bookings" value={bookings.total} icon={CalendarCheck} accent="blue" />
      </div>

      {/* Trend (wide) + upcoming load. */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TrendBars trend={trend} />
        </div>
        <UpcomingPanel upcoming={upcoming} />
      </div>

      {/* Booking funnel + supply. */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <FunnelPanel bookings={bookings} />
        <SupplyPanel supply={supply} />
      </div>

      {/* Action center (signature) + platform pulse. */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {actionCenter ? (
            <ActionCenter data={actionCenter} />
          ) : (
            <p className="text-body-sm text-muted">Couldn&rsquo;t load the action center.</p>
          )}
        </div>
        <ActivityFeed events={activity} />
      </div>
    </div>
  );
}
