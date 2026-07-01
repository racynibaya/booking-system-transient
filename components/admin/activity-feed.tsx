import { CalendarCheck, Star, UserPlus, type LucideIcon } from "lucide-react";

import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import type { ActivityEvent } from "@/lib/supabase/admin-dal";

// Platform pulse — the most recent signups, confirmations, and reviews across every operator.
const KIND_META: Record<ActivityEvent["kind"], { icon: LucideIcon; chip: string }> = {
  operator_signup: { icon: UserPlus, chip: "bg-primary/15 text-primary" },
  booking_confirmed: { icon: CalendarCheck, chip: "bg-success/15 text-success" },
  review_submitted: { icon: Star, chip: "bg-warning/20 text-warning" },
};

// Compact "2h ago" / "3d ago" from an ISO timestamp — no client JS, computed at render.
function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-PH", { month: "short", day: "numeric" });
}

export function ActivityFeed({ events }: { events: ActivityEvent[] }) {
  return (
    <Card className="flex flex-col gap-4 p-5">
      <h2 className="text-title-md text-ink">Recent activity</h2>
      {events.length === 0 ? (
        <EmptyState
          title="Nothing yet"
          description="Signups, confirmations, and reviews land here."
        />
      ) : (
        <ul className="flex flex-col">
          {events.map((e, i) => {
            const meta = KIND_META[e.kind];
            const Icon = meta.icon;
            return (
              <li
                key={`${e.kind}-${e.at}-${i}`}
                className="flex items-start gap-3 border-t border-hairline-soft py-3 first:border-t-0 first:pt-0"
              >
                <span
                  className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md ${meta.chip}`}
                >
                  <Icon className="size-4" />
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-body-sm font-medium text-ink">{e.title}</span>
                  <span className="truncate text-caption text-muted">{e.subtitle}</span>
                </div>
                <span className="shrink-0 text-caption-sm text-muted-soft tabular-nums">
                  {relativeTime(e.at)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
