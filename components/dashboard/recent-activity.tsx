import { CheckCircle2, Clock, History, MailQuestion, XCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";

import { Card } from "@/components/ui/card";
import { IconChip } from "@/components/ui/icon-chip";
import { relativeDay } from "@/lib/dates";
import type { Database } from "@/lib/supabase/database.types";

type BookingStatus = Database["public"]["Enums"]["booking_status"];
type Tone = "sea" | "success" | "warning" | "danger";

export type ActivityItem = {
  id: string;
  guest_name: string;
  status: BookingStatus;
  room: string | null;
  createdAt: string;
};

// What each current status reads as in the feed. Derived from the booking row (no events table) —
// new requests, confirmations, cancellations as they came in, newest first.
const ACTIVITY: Record<BookingStatus, { icon: LucideIcon; verb: string; tone: Tone }> = {
  pending: { icon: Clock, verb: "Started a booking", tone: "sea" },
  held: { icon: Clock, verb: "Holding a room", tone: "warning" },
  awaiting_confirmation: { icon: MailQuestion, verb: "New request", tone: "warning" },
  confirmed: { icon: CheckCircle2, verb: "Confirmed", tone: "success" },
  completed: { icon: CheckCircle2, verb: "Completed stay", tone: "success" },
  cancelled: { icon: XCircle, verb: "Cancelled", tone: "danger" },
  expired: { icon: Clock, verb: "Hold expired", tone: "sea" },
  no_show: { icon: XCircle, verb: "No-show", tone: "danger" },
};

// M6 — a read-only activity stream: the latest things that happened across the operator's bookings,
// each a tap to the full record. Re-composed from data already loaded; messages + payouts feed in
// here once those rails land.
export function RecentActivity({ items }: { items: ActivityItem[] }) {
  return (
    <Card lift className="flex flex-col gap-3 p-5">
      <div className="flex items-center gap-2.5">
        <IconChip icon={History} tone="sea" />
        <h2 className="text-title-md text-ink">Recent activity</h2>
      </div>

      {items.length === 0 ? (
        <p className="text-body-sm text-muted">No activity yet — it&rsquo;ll show up here.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-hairline-soft">
          {items.map((it) => {
            const a = ACTIVITY[it.status];
            return (
              <li key={it.id}>
                <Link
                  href={`/bookings/${it.id}`}
                  className="group flex items-center gap-3 py-3 transition-colors first:pt-1 hover:bg-surface-soft/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                >
                  <IconChip icon={a.icon} tone={a.tone} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-body-md text-ink">
                      <span className="font-medium">{a.verb}</span> — {it.guest_name}
                    </p>
                    <p className="truncate text-caption-sm text-muted">
                      {it.room ?? "Room"} · {relativeDay(it.createdAt.slice(0, 10))}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
