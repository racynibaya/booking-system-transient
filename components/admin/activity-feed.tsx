import { CalendarCheck, UserPlus } from "lucide-react";

import type { AdminActivity } from "@/lib/supabase/admin-dal";

// Platform activity feed — the reference's activity log. Interleaves recent operator signups and
// booking confirmations (see admin_recent_activity RPC). 'kind' picks the icon + tint.
const KIND_META = {
  operator_signup: { icon: UserPlus, cls: "bg-primary/10 text-primary" },
  booking_confirmed: { icon: CalendarCheck, cls: "bg-success-bg text-success" },
} as const;

function relativeTime(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

export function ActivityFeed({ items }: { items: AdminActivity[] }) {
  if (items.length === 0) {
    return <p className="text-body-sm text-muted">No recent activity.</p>;
  }

  return (
    <ul className="flex flex-col gap-4">
      {items.map((it, i) => {
        const meta = KIND_META[it.kind];
        const Icon = meta.icon;
        return (
          <li key={`${it.kind}-${it.at}-${i}`} className="flex items-start gap-3">
            <span
              className={`flex size-8 shrink-0 items-center justify-center rounded-full ${meta.cls}`}
            >
              <Icon className="size-4" />
            </span>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-body-sm font-medium text-ink">{it.title}</span>
              <span className="truncate text-caption-sm text-muted">{it.subtitle}</span>
            </div>
            <span className="shrink-0 text-caption-sm text-muted-soft">{relativeTime(it.at)}</span>
          </li>
        );
      })}
    </ul>
  );
}
