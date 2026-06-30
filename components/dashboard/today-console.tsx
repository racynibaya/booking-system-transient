import {
  ArrowDownToLine,
  ArrowUpFromLine,
  BedDouble,
  Bell,
  CalendarCheck,
  ChevronRight,
  Sun,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { IconChip } from "@/components/ui/icon-chip";
import { STATUS_LABELS } from "@/lib/bookings";
import { formatDateShort } from "@/lib/dates";
import type { Database } from "@/lib/supabase/database.types";

type BookingStatus = Database["public"]["Enums"]["booking_status"];

// The minimal shape the console renders (a subset of a getBookings row).
export type TodayBooking = {
  id: string;
  guest_name: string;
  num_guests: number;
  check_in: string;
  check_out: string;
  status: BookingStatus;
  properties: { name: string } | null;
  room_types: { name: string } | null;
};

const STATUS_TONE: Partial<Record<BookingStatus, "success" | "warning" | "neutral">> = {
  confirmed: "success",
  awaiting_confirmation: "warning",
  held: "warning",
};

// The operator's day on one surface: the four counts that define a shift, then the actual
// arrivals to work through. Re-composes data the dashboard already loads — no new queries.
function Kpi({
  icon,
  count,
  label,
  href,
  tone = "sea",
  urgent = false,
}: {
  icon: LucideIcon;
  count: number;
  label: string;
  href: string;
  tone?: "sea" | "success" | "warning";
  urgent?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group flex items-center gap-2.5 rounded-md border bg-canvas px-3 py-2.5 transition-[border-color,background-color] duration-150 hover:bg-surface-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
        urgent && count > 0 ? "border-warning/40" : "border-hairline"
      }`}
    >
      <IconChip icon={icon} tone={urgent && count > 0 ? "warning" : tone} size="sm" />
      <span className="min-w-0">
        <span className="block text-title-md leading-tight text-ink">{count}</span>
        <span className="block truncate text-caption-sm text-muted">{label}</span>
      </span>
    </Link>
  );
}

export function TodayConsole({
  today,
  arrivals,
  departuresCount,
  stayingCount,
  needsConfirmation,
  expiringHolds,
  owesCount,
}: {
  today: string;
  arrivals: TodayBooking[];
  departuresCount: number;
  stayingCount: number;
  needsConfirmation: number;
  expiringHolds: number;
  owesCount: number;
}) {
  const actionCount = needsConfirmation + expiringHolds;

  return (
    <Card elevation={1} className="flex flex-col gap-4 p-5 md:p-6">
      <div className="flex items-center gap-2.5">
        <IconChip icon={Sun} tone="sea" />
        <div>
          <h2 className="text-title-md text-ink">Today</h2>
          <p className="text-caption-sm text-muted">
            {formatDateShort(today)} · your day at a glance
          </p>
        </div>
      </div>

      {/* KPI strip — the shift in five taps. */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
        <Kpi
          icon={ArrowDownToLine}
          count={arrivals.length}
          label="Arriving"
          href="/bookings?view=soon"
        />
        <Kpi
          icon={BedDouble}
          count={stayingCount}
          label="Staying tonight"
          href="/bookings?view=upcoming"
        />
        <Kpi
          icon={ArrowUpFromLine}
          count={departuresCount}
          label="Departing"
          href="/bookings?view=upcoming"
        />
        <Kpi
          icon={Bell}
          count={actionCount}
          label="Needs action"
          href="/bookings?view=action"
          urgent
        />
        <Kpi icon={Wallet} count={owesCount} label="Unpaid" href="/bookings?view=upcoming" urgent />
      </div>

      {/* Arrivals — the primary work of the day. */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <ArrowDownToLine className="size-4 text-muted" />
          <h3 className="text-title-sm text-ink">Arriving today</h3>
        </div>

        {arrivals.length === 0 ? (
          <div className="flex items-center gap-2.5 rounded-md bg-surface-soft px-4 py-4">
            <CalendarCheck className="size-4 shrink-0 text-success" />
            <p className="text-body-sm text-muted">No arrivals today — enjoy the calm.</p>
          </div>
        ) : (
          <ul className="flex flex-col divide-y divide-hairline-soft">
            {arrivals.map((b) => (
              <li key={b.id}>
                <Link
                  href={`/bookings/${b.id}`}
                  className="group flex items-center gap-3 py-3 transition-colors first:pt-1 hover:bg-surface-soft/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-title-sm text-ink">{b.guest_name}</p>
                    <p className="truncate text-caption-sm text-muted">
                      {b.room_types?.name ?? "Room"} · {b.num_guests} guest
                      {b.num_guests > 1 ? "s" : ""} · until {formatDateShort(b.check_out)}
                    </p>
                  </div>
                  <Badge tone={STATUS_TONE[b.status] ?? "neutral"}>{STATUS_LABELS[b.status]}</Badge>
                  <ChevronRight className="size-5 shrink-0 text-muted-soft transition-transform group-hover:translate-x-0.5" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
