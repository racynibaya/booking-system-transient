import { ArrowRight, CalendarCheck, Coins, Hourglass, Receipt } from "lucide-react";
import Link from "next/link";

import { BillingPanel } from "@/components/admin/billing-panel";
import { DashboardGreeting } from "@/components/admin/dashboard-greeting";
import { FunnelPanel } from "@/components/admin/funnel-panel";
import { KpiCard } from "@/components/admin/kpi-card";
import { RevenueHero } from "@/components/admin/revenue-hero";
import { SupplyPanel } from "@/components/admin/supply-panel";
import { TrendBars } from "@/components/admin/trend-bars";
import { UpcomingPanel } from "@/components/admin/upcoming-panel";
import { getBillingHealth, getDashboardOverview, requireAdmin } from "@/lib/supabase/admin-dal";

const peso = (n: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(n);

// A review-queue row: a count that links into /admin/operators. Highlighted in Rausch when there's
// something waiting, quiet when there's nothing to do.
function ReviewRow({ label, value, hint }: { label: string; value: number; hint: string }) {
  const active = value > 0;
  return (
    <Link
      href="/admin/operators"
      className="group flex items-center justify-between gap-3 rounded-md border border-hairline bg-canvas px-4 py-3 transition-colors hover:border-border-strong focus-visible:border-primary focus-visible:outline-none"
    >
      <div className="flex flex-col">
        <span className="text-body-sm font-medium text-ink">{label}</span>
        <span className="text-caption-sm text-muted">{active ? hint : "All clear"}</span>
      </div>
      <span className="flex items-center gap-1.5">
        <span className={`text-display-sm ${active ? "text-primary" : "text-ink"}`}>{value}</span>
        <ArrowRight className="size-3.5 text-muted transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

export default async function AdminOverviewPage() {
  const tenant = await requireAdmin();
  const [overview, billing] = await Promise.all([getDashboardOverview(), getBillingHealth()]);

  if (!overview) {
    return (
      <div className="flex flex-col gap-6">
        <DashboardGreeting name={tenant.name} />
        <p className="text-body-sm text-muted">Couldn&rsquo;t load the dashboard right now.</p>
      </div>
    );
  }

  const { financials, operators, bookings, trend, supply, upcoming } = overview;

  return (
    <div className="flex flex-col gap-6">
      <DashboardGreeting name={tenant.name} />

      {/* Financials + operator funnel. */}
      <RevenueHero
        gmvFormatted={peso(financials.gmv)}
        confirmedCount={bookings.confirmed}
        operators={operators}
      />

      {/* Headline money KPIs. */}
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

      {/* Subscription billing health — who pays, who lapsed. */}
      {billing && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <BillingPanel billing={billing} />
        </div>
      )}

      {/* Action center — the verification queue. */}
      <section className="flex flex-col gap-3">
        <h2 className="text-title-md text-ink">Needs review</h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <ReviewRow label="Pending review" value={operators.pending} hint="Waiting to go live" />
          <ReviewRow
            label="Changes requested"
            value={operators.changes_requested}
            hint="Sent back for fixes"
          />
          <ReviewRow
            label="GCash re-verify"
            value={operators.gcash_flagged}
            hint="Payout changed — re-check"
          />
        </div>
      </section>
    </div>
  );
}
