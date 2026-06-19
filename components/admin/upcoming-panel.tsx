import { CalendarClock } from "lucide-react";

import { Card } from "@/components/ui/card";
import type { DashboardOverview } from "@/lib/supabase/admin-dal";

// Confirmed check-in load that's coming — aggregate counts + expected guests, no records.
type Upcoming = DashboardOverview["upcoming"];

function Window({ range, count, guests }: { range: string; count: number; guests: number }) {
  return (
    <div className="flex flex-col gap-1 rounded-md bg-legal-link/[0.06] p-4">
      <span className="text-caption-sm text-muted">{range}</span>
      <span className="text-display-sm text-ink">
        {count} <span className="text-body-sm font-normal text-muted">check-ins</span>
      </span>
      <span className="text-caption-sm text-muted">{guests} guests expected</span>
    </div>
  );
}

export function UpcomingPanel({ upcoming }: { upcoming: Upcoming }) {
  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex items-center gap-2">
        <CalendarClock className="size-4 text-legal-link" />
        <h2 className="text-title-md text-ink">Upcoming check-ins</h2>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
        <Window range="Next 7 days" count={upcoming.next7} guests={upcoming.next7_guests} />
        <Window range="Next 30 days" count={upcoming.next30} guests={upcoming.next30_guests} />
      </div>
    </Card>
  );
}
