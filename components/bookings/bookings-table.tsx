"use client";

import { format } from "date-fns";
import { CalendarRange } from "lucide-react";
import { useMemo, useState, type ComponentProps } from "react";

import { CancelBookingButton } from "@/components/bookings/cancel-booking-button";
import { ConfirmBookingButton } from "@/components/bookings/confirm-booking-button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { daysFromToday, fromDateStr, relativeDay, todayStr } from "@/lib/dates";
import type { getBookings } from "@/lib/supabase/dal";
import type { Database } from "@/lib/supabase/database.types";

type Booking = Awaited<ReturnType<typeof getBookings>>[number];
type Status = Database["public"]["Enums"]["booking_status"];

function prettyDate(s: string) {
  return format(fromDateStr(s), "MMM d");
}

function peso(amount: number | null) {
  return amount == null ? "—" : `₱${amount.toLocaleString("en-PH")}`;
}

// Status → label + semantic badge tone (amber = needs action, green = confirmed, red = dead).
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

// Statuses an operator can still act on (Confirm/Cancel). Terminal ones show no actions.
const ACTIVE: Status[] = ["held", "awaiting_confirmation", "confirmed"];
const isLive = (s: Status) => s === "held" || s === "awaiting_confirmation" || s === "confirmed";

type Chip = "upcoming" | "soon" | "action" | "past";
const CHIPS: { key: Chip; label: string }[] = [
  { key: "upcoming", label: "All upcoming" },
  { key: "soon", label: "Arriving soon" },
  { key: "action", label: "Needs action" },
  { key: "past", label: "Past" },
];
const EMPTY_MSG: Record<Chip, string> = {
  upcoming: "No upcoming bookings.",
  soon: "Nothing arriving in the next 7 days.",
  action: "Nothing needs your action right now. 🎉",
  past: "No past bookings yet.",
};

// The "arriving in…" pill: green while a guest is staying, amber when arriving within 2 days.
function datePill(b: Booking, today: string): { label: string; cls: string } {
  if (b.check_in <= today && b.check_out >= today)
    return { label: "Staying now", cls: "bg-success-bg text-success" };
  const d = daysFromToday(b.check_in);
  const label = relativeDay(b.check_in);
  if (d >= 0 && d <= 2) return { label, cls: "bg-warning-bg text-warning" };
  return { label, cls: "bg-surface-strong text-body" };
}

// F2.1 bookings board — the operator's daily driver. Soonest check-in first, quick-chip filters
// (so "who's arriving next" is the default view, not a wall of rows), responsive cards instead of
// a wide table. Inline Confirm/Cancel; inventory effects handled server-side by the status write.
export function BookingsTable({ bookings }: { bookings: Booking[] }) {
  const [chip, setChip] = useState<Chip>("upcoming");
  const today = todayStr();

  const tagged = useMemo(
    () => bookings.map((b) => ({ b, upcoming: isLive(b.status) && b.check_out >= today })),
    [bookings, today],
  );

  const counts = useMemo<Record<Chip, number>>(
    () => ({
      upcoming: tagged.filter((t) => t.upcoming).length,
      soon: tagged.filter((t) => t.upcoming && daysFromToday(t.b.check_in) <= 7).length,
      action: tagged.filter((t) => t.b.status === "awaiting_confirmation" || t.b.status === "held")
        .length,
      past: tagged.filter((t) => !t.upcoming).length,
    }),
    [tagged],
  );

  const rows = useMemo(() => {
    const list = tagged.filter((t) => {
      if (chip === "upcoming") return t.upcoming;
      if (chip === "soon") return t.upcoming && daysFromToday(t.b.check_in) <= 7;
      if (chip === "action") return t.b.status === "awaiting_confirmation" || t.b.status === "held";
      return !t.upcoming; // past
    });
    list.sort((a, b) => {
      if (chip === "past") return b.b.check_in.localeCompare(a.b.check_in); // most recent first
      if (chip === "action") {
        const rank = (s: Status) => (s === "awaiting_confirmation" ? 0 : 1);
        return rank(a.b.status) - rank(b.b.status) || a.b.check_in.localeCompare(b.b.check_in);
      }
      return a.b.check_in.localeCompare(b.b.check_in); // soonest first
    });
    return list.map((t) => t.b);
  }, [tagged, chip]);

  return (
    <div className="flex flex-col gap-4">
      {/* Quick filters — "Needs action" goes amber when there's something to do */}
      <div className="flex flex-wrap gap-2">
        {CHIPS.map((c) => {
          const active = chip === c.key;
          const n = counts[c.key];
          const flag = c.key === "action" && n > 0;
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => setChip(c.key)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-body-sm transition-colors focus-visible:outline-none ${
                active
                  ? "bg-ink text-canvas"
                  : flag
                    ? "bg-warning-bg text-warning hover:opacity-90"
                    : "border border-hairline bg-canvas text-muted hover:text-ink"
              }`}
            >
              {c.label}
              {n > 0 && (
                <span
                  className={`rounded-full px-1.5 text-caption-sm ${
                    active ? "bg-canvas/20" : flag ? "bg-warning/20" : "bg-surface-strong text-body"
                  }`}
                >
                  {n}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={CalendarRange}
          title={bookings.length === 0 ? "No bookings yet" : "Nothing here"}
          description={
            bookings.length === 0
              ? "When a guest books — or you log a walk-in — it'll show up here."
              : EMPTY_MSG[chip]
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((b) => {
            const meta = STATUS_META[b.status];
            const contact = b.guest_phone ?? b.guest_email;
            const pill = datePill(b, today);
            return (
              <Card key={b.id} className="flex flex-col gap-2.5 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-title-md text-ink">{b.guest_name}</p>
                    {contact && (
                      <p className="mt-0.5 truncate text-caption-sm text-muted">{contact}</p>
                    )}
                  </div>
                  <Badge tone={meta.tone}>{meta.label}</Badge>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 text-body-sm font-medium text-ink">
                    <CalendarRange className="size-4 text-muted" />
                    {prettyDate(b.check_in)} – {prettyDate(b.check_out)}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-caption-sm ${pill.cls}`}>
                    {pill.label}
                  </span>
                  <span className="text-caption-sm text-muted">
                    {b.num_guests} {b.num_guests === 1 ? "guest" : "guests"}
                  </span>
                </div>

                <p className="truncate text-caption-sm text-muted">
                  {b.properties?.name ?? "—"}
                  {b.room_types?.name ? ` · ${b.room_types.name}` : ""}
                </p>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline-soft pt-2.5">
                  <span className="text-caption-sm text-muted">
                    Deposit <span className="text-ink">{peso(b.deposit_amount)}</span> · Total{" "}
                    <span className="text-ink">{peso(b.total_amount)}</span>
                  </span>
                  {ACTIVE.includes(b.status) && (
                    <div className="flex gap-2">
                      {b.status === "awaiting_confirmation" && (
                        <ConfirmBookingButton bookingId={b.id} guestName={b.guest_name} />
                      )}
                      <CancelBookingButton bookingId={b.id} guestName={b.guest_name} />
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
