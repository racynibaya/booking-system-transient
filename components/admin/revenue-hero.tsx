import { BadgeCheck, CircleDashed, Clock, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";

// The dashboard centerpiece — the reference's "My Asset" balance card, reframed as platform money.
// GMV (booking value flowing through the platform) is the real headline today; subscription MRR is
// the number we WANT to show, but there's no pricing model or billing capture yet — so it sits in a
// clearly-labeled "pending" slot rather than a fabricated figure. See the dashboard plan/context.
// Each funnel tile wears its own brand accent so the hero reads playful, not monochrome.
type FunnelTile = { label: string; value: number; icon: typeof Users; chip: string; tint: string };

export function RevenueHero({
  gmvFormatted,
  confirmedCount,
  operators,
}: {
  gmvFormatted: string;
  confirmedCount: number;
  operators: { total: number; approved: number; trialing: number; active: number };
}) {
  const tiles: FunnelTile[] = [
    {
      label: "Total operators",
      value: operators.total,
      icon: Users,
      chip: "bg-primary/15 text-primary",
      tint: "bg-primary/[0.04]",
    },
    {
      label: "Approved (live)",
      value: operators.approved,
      icon: BadgeCheck,
      chip: "bg-success/15 text-success",
      tint: "bg-success/[0.05]",
    },
    {
      label: "Trialing",
      value: operators.trialing,
      icon: CircleDashed,
      chip: "bg-warning/20 text-warning",
      tint: "bg-warning/[0.06]",
    },
    {
      label: "Active subs",
      value: operators.active,
      icon: Clock,
      chip: "bg-luxe/15 text-luxe",
      tint: "bg-luxe/[0.05]",
    },
  ];

  return (
    <section className="overflow-hidden rounded-md border border-hairline shadow-card">
      <div className="flex flex-col gap-6 bg-linear-to-br from-sunset-1/15 via-primary/[0.07] to-luxe/10 p-5 md:flex-row md:items-start md:justify-between md:p-6">
        {/* GMV — the real money the platform moves today. */}
        <div className="flex flex-col gap-1">
          <p className="text-caption text-muted">Platform GMV</p>
          <p className="text-[2.25rem] leading-none font-semibold tracking-tight text-ink md:text-[2.75rem]">
            {gmvFormatted}
          </p>
          <p className="mt-1 text-caption-sm text-muted">
            Booking value across {confirmedCount} confirmed{" "}
            {confirmedCount === 1 ? "booking" : "bookings"}
          </p>
        </div>

        {/* MRR — what we WANT to track. No pricing model decided yet, so no number. */}
        <div className="rounded-md border border-dashed border-luxe/30 bg-canvas/70 p-4 backdrop-blur-sm md:min-w-60">
          <div className="flex items-center justify-between gap-2">
            <p className="text-caption text-muted">Subscription MRR</p>
            <Badge tone="warning">Pending pricing</Badge>
          </div>
          <p className="mt-1 text-display-sm text-muted-soft">—</p>
          <p className="mt-1 text-caption-sm text-muted">
            No billing model set yet. This lights up once operators are charged.
          </p>
        </div>
      </div>

      {/* Operator funnel — the reference's asset-folder tiles, as platform standing. */}
      <div className="grid grid-cols-2 gap-px border-t border-hairline bg-hairline md:grid-cols-4">
        {tiles.map((t) => {
          const Icon = t.icon;
          return (
            <div key={t.label} className={`flex items-center gap-3 p-4 ${t.tint}`}>
              <span
                className={`flex size-9 shrink-0 items-center justify-center rounded-md ${t.chip}`}
              >
                <Icon className="size-4.5" />
              </span>
              <div className="flex flex-col">
                <span className="text-display-sm text-ink">{t.value}</span>
                <span className="text-caption-sm text-muted">{t.label}</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
