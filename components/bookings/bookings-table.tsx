"use client";

import { format } from "date-fns";
import { CalendarRange, Receipt, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type ComponentProps } from "react";

import { CancelBookingButton } from "@/components/bookings/cancel-booking-button";
import { ConfirmBookingButton } from "@/components/bookings/confirm-booking-button";
import { HoldCountdown } from "@/components/bookings/hold-countdown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { isNewRequest, STATUS_LABELS, type BookingView } from "@/lib/bookings";
import { daysFromToday, fromDateStr, relativeDay } from "@/lib/dates";
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

// Status → semantic badge tone (amber = needs action, green = confirmed, red = dead).
// Labels are shared with the filter bar via STATUS_LABELS (lib/bookings).
const STATUS_TONE: Record<Status, ComponentProps<typeof Badge>["tone"]> = {
  pending: "muted",
  held: "neutral",
  awaiting_confirmation: "warning",
  confirmed: "success",
  cancelled: "danger",
  expired: "muted",
  completed: "neutral",
  no_show: "danger",
};

// Statuses an operator can still act on (Confirm/Cancel). Terminal ones show no actions.
const ACTIVE: Status[] = ["held", "awaiting_confirmation", "confirmed"];

// Left accent bar for the most time-critical Needs-action rows: red = reply overdue,
// gold = held/hold ticking. Clipped to the card radius via overflow-hidden.
const BAR =
  "relative overflow-hidden before:absolute before:inset-y-0 before:left-0 before:w-1 before:content-['']";

// Every card carries a status-colored left spine so the board scans by color at a glance:
// sea = confirmed/live, gold = needs-action/held, faint = pending, muted = dead. The urgent
// Needs-action cues (red overdue / gold countdown) override this below.
const SPINE: Record<Status, string> = {
  pending: "before:bg-border-strong",
  held: "before:bg-accent-warm",
  awaiting_confirmation: "before:bg-warning",
  confirmed: "before:bg-primary",
  completed: "before:bg-sea",
  cancelled: "before:bg-muted-soft",
  expired: "before:bg-muted-soft",
  no_show: "before:bg-error/60",
};

// The "arriving in…" pill: green while a guest is staying, amber when arriving within 2 days.
function datePill(b: Booking, today: string): { label: string; cls: string } {
  if (b.check_in <= today && b.check_out >= today) {
    // Only a paid booking is genuinely "staying now". An unpaid hold (or awaiting-proof) whose
    // dates merely overlap today must NOT look like a live, paid stay — show a neutral pill so the
    // green is reserved for confirmed/completed guests. The status badge still reads "Held".
    if (b.status === "confirmed" || b.status === "completed")
      return { label: "Staying now", cls: "bg-success-bg text-success" };
    return { label: "Dates active", cls: "bg-surface-strong text-body" };
  }
  const d = daysFromToday(b.check_in, today);
  const label = relativeDay(b.check_in, today);
  if (d >= 0 && d <= 2) return { label, cls: "bg-warning-bg text-warning" };
  return { label, cls: "bg-surface-strong text-body" };
}

// F2.1 bookings board — the operator's daily driver. Presentational: it renders the rows
// the page has already filtered + sorted server-side (see BookingsFilters / lib/bookings).
// Responsive cards instead of a wide table; inline Confirm/Cancel, with inventory effects
// handled server-side by the status write.
export function BookingsTable({
  bookings,
  hasAnyBookings,
  view,
  today,
}: {
  bookings: Booking[];
  hasAnyBookings: boolean;
  view: BookingView;
  // `today` (YYYY-MM-DD) is computed once on the server and passed in, so the date pills render
  // identically on server and client — no hydration mismatch from the client recomputing its own
  // local today (server UTC vs client local would diverge near midnight).
  today: string;
}) {
  // The proof receipt to show enlarged, in-app (so the operator never leaves the board to check it).
  const [proof, setProof] = useState<string | null>(null);

  useEffect(() => {
    if (!proof) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setProof(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [proof]);

  return (
    <div className="flex flex-col gap-4">
      {bookings.length === 0 ? (
        <EmptyState
          icon={CalendarRange}
          title={hasAnyBookings ? "No matching bookings" : "No bookings yet"}
          description={
            hasAnyBookings
              ? "No bookings match these filters. Try clearing some."
              : "When a guest books — or you log a walk-in — it'll show up here."
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {bookings.map((b, i) => {
            const contact = b.guest_phone ?? b.guest_email;
            const pill = datePill(b, today);
            const where = `${b.properties?.name ?? "—"}${b.room_types?.name ? ` · ${b.room_types.name}` : ""}`;
            // Glanceability cues live only in Needs action (other views unchanged). isNew/isOverdue
            // read Date.now() via isNewRequest — same boundary nit as before, harmless; the hold
            // countdown itself is hydration-safe (see HoldCountdown).
            const isAction = view === "action";
            const showCountdown = isAction && b.status === "held" && Boolean(b.hold_expires_at);
            const isOverdue = isAction && b.status !== "held" && !isNewRequest(b.created_at);
            const isNew = isAction && isNewRequest(b.created_at);
            const spine = isOverdue
              ? "before:bg-error"
              : showCountdown
                ? "before:bg-accent-warm"
                : SPINE[b.status];
            return (
              <Card
                key={b.id}
                lift
                style={{ animationDelay: `${Math.min(i, 8) * 45}ms` }}
                className={`${BAR} flex animate-card-rise flex-col gap-2.5 p-4 pl-5 ${spine}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/bookings/${b.id}`}
                      className="truncate text-title-md text-ink underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                    >
                      {b.guest_name}
                    </Link>
                    {contact && (
                      <p className="mt-0.5 truncate text-caption-sm text-muted">{contact}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {/* "Tuloy brought you this" — the founder's demand-gen made visible. Brand-tinted
                        so it reads as a positive signal, distinct from the red/gold urgency cues. */}
                    {b.source === "tuloy" && (
                      <span className="inline-flex items-center rounded-full bg-linear-to-r from-primary/15 to-sea/15 px-2.5 py-0.5 text-badge font-medium text-primary">
                        via Tuloy
                      </span>
                    )}
                    {/* "New" is deliberately quiet (outline, not a colored fill) so it never
                        out-shouts the red/gold urgency cues — the eye should land on those. */}
                    {isNew && (
                      <span className="inline-flex items-center rounded-full border border-hairline px-2.5 py-0.5 text-badge font-medium text-muted">
                        New
                      </span>
                    )}
                    <Badge tone={STATUS_TONE[b.status]}>{STATUS_LABELS[b.status]}</Badge>
                  </div>
                </div>

                {isOverdue && (
                  <span className="inline-flex w-fit items-center gap-2 rounded-full bg-error/10 px-3 py-1 text-body-sm font-semibold text-error">
                    <span className="size-2 rounded-full bg-error" aria-hidden />
                    Reply overdue
                  </span>
                )}

                {showCountdown ? (
                  <>
                    <HoldCountdown expiresAt={b.hold_expires_at!} />
                    <p className="truncate text-caption-sm text-muted">
                      Stay {prettyDate(b.check_in)} – {prettyDate(b.check_out)} · {b.num_guests}{" "}
                      {b.num_guests === 1 ? "guest" : "guests"} · {where}
                    </p>
                  </>
                ) : (
                  <>
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
                    <p className="truncate text-caption-sm text-muted">{where}</p>
                  </>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline-soft pt-2.5">
                  <span className="text-caption-sm text-muted">
                    Deposit <span className="text-ink">{peso(b.deposit_amount)}</span> · Total{" "}
                    <span className="text-ink">{peso(b.total_amount)}</span>
                  </span>
                  {ACTIVE.includes(b.status) && (
                    <div className="flex gap-2">
                      {b.status === "awaiting_confirmation" && b.proofUrl && (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          aria-label="View payment proof"
                          title="View payment proof"
                          onClick={() => setProof(b.proofUrl)}
                          className="relative"
                        >
                          <Receipt className="size-4" />
                          {/* A gentle pulsing "beep" dot draws the eye to the unreviewed proof. */}
                          <span className="pointer-events-none absolute -top-1.5 -right-1.5 flex size-3">
                            <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent-warm opacity-75" />
                            <span className="relative inline-flex size-3 rounded-full border-2 border-canvas bg-accent-warm" />
                          </span>
                        </Button>
                      )}
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

      {proof && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Payment proof"
          onClick={() => setProof(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 p-4 backdrop-blur-sm"
        >
          <button
            type="button"
            onClick={() => setProof(null)}
            aria-label="Close"
            className="absolute top-4 right-4 flex size-10 items-center justify-center rounded-full bg-canvas/90 text-ink transition-colors hover:bg-canvas focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <X className="size-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed proof URL */}
          <img
            src={proof}
            alt="Payment proof"
            onClick={(e) => e.stopPropagation()}
            className="max-h-[85vh] max-w-[90vw] rounded-md border border-hairline object-contain shadow-card"
          />
        </div>
      )}
    </div>
  );
}
