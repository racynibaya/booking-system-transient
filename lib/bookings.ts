import { addDays, fromDateStr, isOlderThanHours } from "@/lib/dates";
import type { Database } from "@/lib/supabase/database.types";

type BookingStatus = Database["public"]["Enums"]["booking_status"];

// A held booking whose hold has lapsed no longer occupies inventory — every occupancy query
// filters on (hold_expires_at is null or hold_expires_at > now()), so those dates are already
// free. But the stored `status` still says 'held', so the dashboard would show a dead hold as
// "Held" until something flips it. We reconcile that at read time: treat a lapsed hold as
// 'expired' for display, so the board matches reality without a background sweep.
//
// Only 'held' is overridden — 'awaiting_confirmation' clears hold_expires_at (sweep-exempt by
// design) and 'confirmed' has no expiry, so neither is affected.
export function effectiveStatus(
  status: BookingStatus,
  holdExpiresAt: string | null,
  now: number = Date.now(),
): BookingStatus {
  if (status === "held" && holdExpiresAt && Date.parse(holdExpiresAt) <= now) {
    return "expired";
  }
  return status;
}

// ---------------------------------------------------------------------------
// Bookings dashboard — shared filtering, smart views, and status vocabulary.
// Pure + framework-free so the same logic runs in the Server Component (page),
// the DAL, and the client filter bar without drift.
// ---------------------------------------------------------------------------

// Statuses still occupying inventory / actionable — the spine of the "upcoming" view.
export function isLive(status: BookingStatus): boolean {
  return status === "held" || status === "awaiting_confirmation" || status === "confirmed";
}

// Canonical status order + labels. Single source so the table (display) and the
// filter bar (status multi-select) never disagree.
export const BOOKING_STATUSES: BookingStatus[] = [
  "pending",
  "held",
  "awaiting_confirmation",
  "confirmed",
  "cancelled",
  "expired",
  "completed",
  "no_show",
];

export const STATUS_LABELS: Record<BookingStatus, string> = {
  pending: "Pending",
  held: "Held",
  awaiting_confirmation: "Awaiting",
  confirmed: "Confirmed",
  cancelled: "Cancelled",
  expired: "Expired",
  completed: "Completed",
  no_show: "No-show",
};

// Smart quick-views (the board's presets). Not raw filters — "upcoming" keys off
// check_out so guests staying right now stay visible, which a check_in range can't express.
export const BOOKING_VIEWS = ["upcoming", "soon", "action", "past"] as const;
export type BookingView = (typeof BOOKING_VIEWS)[number];

export const VIEW_LABELS: Record<BookingView, string> = {
  upcoming: "All upcoming",
  soon: "Arriving soon",
  action: "Needs action",
  past: "Past",
};

// Target time to reply to a guest in Needs action. Drives the response clock
// (created_at + this) that the urgency sort races, and the "New" badge window.
// Config so it can change later.
export const RESPONSE_TARGET_HOURS = 24;

// SQL-pushable filters (see getBookings). Already validated by parseBookingFilters.
export type BookingFilters = {
  property?: string;
  room?: string;
  q?: string;
  from?: string; // YYYY-MM-DD — check_in >= from
  to?: string; // YYYY-MM-DD — check_in <= to
};

export type ParsedBookingQuery = BookingFilters & {
  status: BookingStatus[];
  view: BookingView;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const firstParam = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

// Parse the page's searchParams into a validated query: unknown statuses/views and
// malformed dates are dropped, so the rest of the pipeline trusts its inputs.
export function parseBookingFilters(
  sp: Record<string, string | string[] | undefined>,
): ParsedBookingQuery {
  const trimmed = (k: string) => firstParam(sp[k])?.trim() || undefined;

  const fromRaw = trimmed("from");
  const toRaw = trimmed("to");

  const status = (firstParam(sp.status)?.split(",") ?? [])
    .map((s) => s.trim())
    .filter((s): s is BookingStatus => (BOOKING_STATUSES as string[]).includes(s));

  const viewRaw = firstParam(sp.view);
  const view: BookingView = (BOOKING_VIEWS as readonly string[]).includes(viewRaw ?? "")
    ? (viewRaw as BookingView)
    : "upcoming";

  return {
    property: trimmed("property"),
    room: trimmed("room"),
    q: trimmed("q"),
    from: fromRaw && DATE_RE.test(fromRaw) ? fromRaw : undefined,
    to: toRaw && DATE_RE.test(toRaw) ? toRaw : undefined,
    status,
    view,
  };
}

type ViewRow = {
  status: BookingStatus;
  check_in: string;
  check_out: string;
  created_at: string;
  hold_expires_at: string | null;
};

const isUpcoming = (b: ViewRow, today: string) => isLive(b.status) && b.check_out >= today;
const needsAction = (b: ViewRow) => b.status === "awaiting_confirmation" || b.status === "held";

// Needs-action urgency: the soonest of two clocks, as epoch ms (smaller = more urgent).
// Response clock = created_at + the reply target. Arrival clock = check_in, except a live
// hold races its hold_expires_at — the moment we actually lose the room. (Absolute UTC
// timestamps vs a local-midnight check_in mix fine for ordering; day precision is enough.)
function urgencyAt(b: ViewRow): number {
  const responseDeadline = new Date(b.created_at).getTime() + RESPONSE_TARGET_HOURS * 3_600_000;
  const arrivalDeadline =
    b.status === "held" && b.hold_expires_at
      ? new Date(b.hold_expires_at).getTime()
      : fromDateStr(b.check_in).getTime();
  return Math.min(responseDeadline, arrivalDeadline);
}

// A brand-new request still inside the response target — hasn't aged past our reply window.
// Flags the "New" badge; the urgency sort (not this) decides order.
export function isNewRequest(createdAt: string, hours = RESPONSE_TARGET_HOURS): boolean {
  return !isOlderThanHours(createdAt, hours);
}
// "Arriving soon" = upcoming with a check-in no later than 7 days out. String compare on
// ISO dates is chronological, so this stays a pure function of the passed `today`.
const isSoon = (b: ViewRow, today: string) =>
  isUpcoming(b, today) && b.check_in <= addDays(today, 7);

// Per-view tallies for the preset badges. Computed over rows already narrowed by the
// SQL filters but NOT by the status multi-select — the badges describe each view itself.
export function viewCounts<T extends ViewRow>(
  rows: T[],
  today: string,
): Record<BookingView, number> {
  return {
    upcoming: rows.filter((b) => isUpcoming(b, today)).length,
    soon: rows.filter((b) => isSoon(b, today)).length,
    action: rows.filter(needsAction).length,
    past: rows.filter((b) => !isUpcoming(b, today)).length,
  };
}

// Narrow by the explicit status multi-select (empty = no status constraint).
export function filterByStatus<T extends { status: BookingStatus }>(
  rows: T[],
  status: BookingStatus[],
): T[] {
  if (status.length === 0) return rows;
  const set = new Set(status);
  return rows.filter((b) => set.has(b.status));
}

// Apply a smart view + its sort. Same semantics the chips used before this moved
// server-side: soonest first, except Past (most recent first) and Action (awaiting first).
export function filterAndSortByView<T extends ViewRow>(
  rows: T[],
  view: BookingView,
  today: string,
): T[] {
  const list = rows.filter((b) => {
    if (view === "upcoming") return isUpcoming(b, today);
    if (view === "soon") return isSoon(b, today);
    if (view === "action") return needsAction(b);
    return !isUpcoming(b, today); // past
  });
  return list.slice().sort((a, b) => {
    if (view === "past") return b.check_in.localeCompare(a.check_in);
    if (view === "action") {
      // Most urgent first (soonest of the response/arrival clocks); equal urgency breaks
      // by created_at, oldest first (first come, first served). NOTE: because a live hold
      // races its hold_expires_at (minutes away, see urgencyAt), unpaid holds will briefly
      // lead the list — that's intended ("we're about to lose the room"), not a bug to "fix".
      return urgencyAt(a) - urgencyAt(b) || a.created_at.localeCompare(b.created_at);
    }
    return a.check_in.localeCompare(b.check_in);
  });
}
