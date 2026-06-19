import type { ComponentProps } from "react";

import type { AdminRecentBooking } from "@/lib/supabase/admin-dal";
import { Badge } from "@/components/ui/badge";
import type { Database } from "@/lib/supabase/database.types";

type Status = Database["public"]["Enums"]["booking_status"];

// Local status → label/tone map. Kept here (not imported from the operator bookings-table) so the
// admin surface stays decoupled from the operator app; same semantic scale, minor duplication.
const STATUS_META: Record<Status, { label: string; tone: ComponentProps<typeof Badge>["tone"] }> = {
  pending: { label: "Pending", tone: "muted" },
  held: { label: "Held", tone: "neutral" },
  awaiting_confirmation: { label: "Awaiting", tone: "warning" },
  confirmed: { label: "Confirmed", tone: "success" },
  cancelled: { label: "Cancelled", tone: "danger" },
  expired: { label: "Expired", tone: "muted" },
  completed: { label: "Completed", tone: "neutral" },
  no_show: { label: "No-show", tone: "danger" },
};

// Colored initial-avatars, like the reference's transaction rows. Hue is deterministic from the
// operator name so the same operator always gets the same color — playful but stable.
const AVATARS = [
  "bg-primary/15 text-primary",
  "bg-legal-link/15 text-legal-link",
  "bg-success/15 text-success",
  "bg-warning/20 text-warning",
  "bg-luxe/15 text-luxe",
  "bg-sunset-1/20 text-sunset-1",
];

function avatarFor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATARS[h % AVATARS.length];
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const peso = (n: number | null) =>
  n == null
    ? "—"
    : new Intl.NumberFormat("en-PH", {
        style: "currency",
        currency: "PHP",
        maximumFractionDigits: 0,
      }).format(n);

const day = (iso: string) =>
  new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric" }).format(new Date(iso));

export function RecentBookingsTable({ rows }: { rows: AdminRecentBooking[] }) {
  if (rows.length === 0) {
    return (
      <p className="rounded-md border border-hairline bg-canvas p-6 text-body-sm text-muted">
        No bookings yet across the platform.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border border-hairline bg-canvas">
      {/* Column header — hidden on mobile, where each row stacks. */}
      <div className="hidden grid-cols-[1.5fr_1fr_0.8fr_0.9fr] gap-4 border-b border-hairline px-5 py-3 text-caption-sm text-muted sm:grid">
        <span>Operator</span>
        <span>Guest</span>
        <span>Date</span>
        <span className="text-right">Amount</span>
      </div>
      <ul>
        {rows.map((b) => {
          const meta = STATUS_META[b.status];
          const operator = b.operator_name ?? "Operator";
          return (
            <li
              key={b.booking_id}
              className="flex flex-col gap-2 border-b border-hairline-soft px-5 py-3 last:border-b-0 sm:grid sm:grid-cols-[1.5fr_1fr_0.8fr_0.9fr] sm:items-center sm:gap-4"
            >
              <div className="flex items-center gap-2.5">
                <span
                  className={`flex size-8 shrink-0 items-center justify-center rounded-full text-caption-sm font-semibold ${avatarFor(operator)}`}
                >
                  {initials(operator)}
                </span>
                <span className="truncate text-body-sm font-medium text-ink">{operator}</span>
                <span className="sm:hidden">
                  <Badge tone={meta.tone}>{meta.label}</Badge>
                </span>
              </div>
              <span className="truncate text-body-sm text-body">{b.guest_name}</span>
              <span className="text-body-sm text-muted">{day(b.created_at)}</span>
              <div className="flex items-center justify-between gap-3 sm:justify-end">
                <span className="text-body-sm font-medium text-ink">{peso(b.total_amount)}</span>
                <span className="hidden sm:inline">
                  <Badge tone={meta.tone}>{meta.label}</Badge>
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
