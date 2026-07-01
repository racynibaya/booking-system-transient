import { BarChart3, TrendingUp } from "lucide-react";

import { FunnelChart } from "@/components/insights/funnel-chart";
import { LeadTimeChart } from "@/components/insights/lead-time-chart";
import { TrendChart } from "@/components/insights/trend-chart";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { getInsights, requireUser } from "@/lib/supabase/dal";

const peso = (n: number) => `₱${n.toLocaleString("en-PH")}`;
const pct = (n: number) => `${n}%`;

// S4 — Business insights. Derived trends an operator can act on: what they're earning, how full
// they run, where inquiries turn into bookings, and how far ahead guests book. Every figure is
// computed from existing rows (no analytics pipeline); each chart carries a "Show data" table.
export default async function InsightsPage() {
  await requireUser();
  const insights = await getInsights();

  if (!insights.hasData) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Insights"
          description="Trends from your bookings, occupancy, and inquiries."
        />
        <EmptyState
          icon={BarChart3}
          title="No insights yet"
          description="Once you have bookings and inquiries, your revenue, occupancy, and conversion trends will appear here."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Insights"
        description="Trends from your bookings, occupancy, and inquiries."
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TrendChart
          icon={TrendingUp}
          title="Revenue"
          subtitle="Booking value by stay month"
          points={insights.revenueByMonth}
          format={peso}
          tone="success"
        />
        <TrendChart
          icon={BarChart3}
          title="Occupancy"
          subtitle="Booked room-nights ÷ capacity"
          points={insights.occupancyByMonth}
          format={pct}
          tone="sea"
        />
        <FunnelChart stages={insights.funnel} days={insights.funnelDays} />
        <LeadTimeChart buckets={insights.leadTime} />
      </div>
    </div>
  );
}
