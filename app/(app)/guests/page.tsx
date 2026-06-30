import { ChevronRight, Users } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { formatDateShort } from "@/lib/dates";
import { getGuests, requireUser } from "@/lib/supabase/dal";

const peso = (n: number) => `₱${n.toLocaleString("en-PH")}`;

// S1 — the guest book. Everyone who's booked you, repeat guests first, so you recognize a returning
// guest at a glance and can rebook them faster.
export default async function GuestsPage() {
  await requireUser();
  const guests = await getGuests();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Guests" description="Everyone who's booked you — repeat guests first." />

      {guests.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No guests yet"
          description="Once you take bookings, your guests show up here with their history."
        />
      ) : (
        <Card elevation={1} className="flex flex-col divide-y divide-hairline-soft p-0">
          {guests.map((g) => (
            <Link
              key={g.key}
              href={`/guests/${encodeURIComponent(g.key)}`}
              className="group flex items-center gap-3 p-4 transition-colors first:rounded-t-md last:rounded-b-md hover:bg-surface-soft/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-title-sm text-ink">{g.name}</p>
                  {g.stays > 1 && <Badge tone="accent">{g.stays} stays</Badge>}
                </div>
                <p className="truncate text-caption-sm text-muted">
                  {g.phone || g.email || "—"} · last stay {formatDateShort(g.lastStay)}
                </p>
              </div>
              <span className="shrink-0 text-right">
                <span className="block text-title-sm text-ink">{peso(g.totalValue)}</span>
                <span className="block text-caption-sm text-muted">
                  {g.stays} {g.stays === 1 ? "stay" : "stays"}
                </span>
              </span>
              <ChevronRight className="size-5 shrink-0 text-muted-soft transition-transform group-hover:translate-x-0.5" />
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}
