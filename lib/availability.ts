/**
 * Pure date-range overlap check — the core invariant behind "no double-booking".
 * Kept dependency-free and pure so it's trivially unit-testable. The transactional
 * hold in the DB enforces this for real; this guards the logic and edge cases.
 *
 * Bookings are half-open ranges [checkIn, checkOut): a guest checking out on the
 * same day another checks in does NOT overlap.
 */
import type { DateStr } from "./dates";

export type DateRange = { checkIn: Date; checkOut: Date };

export function rangesOverlap(a: DateRange, b: DateRange): boolean {
  return a.checkIn < b.checkOut && b.checkIn < a.checkOut;
}

export function isAvailable(requested: DateRange, existing: DateRange[]): boolean {
  return !existing.some((booking) => rangesOverlap(requested, booking));
}

// ---------------------------------------------------------------------------
// Calendar availability (F1.2). Works on YYYY-MM-DD strings (see lib/dates.ts):
// string compare on ISO dates is chronological, sidestepping timezone shifts.
// All ranges are half-open [start, end) — the checkout/end day is not occupied.
// ---------------------------------------------------------------------------

export type StayRange = { checkIn: DateStr; checkOut: DateStr };
export type BlockRange = { start: DateStr; end: DateStr };

function dayInHalfOpen(day: DateStr, start: DateStr, end: DateStr): boolean {
  return start <= day && day < end;
}

function halfOpenOverlap(aStart: DateStr, aEnd: DateStr, bStart: DateStr, bEnd: DateStr): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Units bookable on a single day — for calendar coloring. A block closes the whole
 * room_type for that day (no per-unit identity), matching create_booking_hold.
 */
export function unitsAvailableOn(
  day: DateStr,
  quantity: number,
  bookings: StayRange[],
  blocks: BlockRange[],
): number {
  if (blocks.some((b) => dayInHalfOpen(day, b.start, b.end))) return 0;
  const occupied = bookings.filter((bk) => dayInHalfOpen(day, bk.checkIn, bk.checkOut)).length;
  return Math.max(0, quantity - occupied);
}

/**
 * Whether a requested stay can be held — MIRRORS create_booking_hold (F0.2 §1c) so the
 * calendar never shows "available" when the RPC would reject. `bookings` must already be
 * the live held+confirmed set (the DAL filters expired holds). Guarded by
 * tests/availability-parity.test.ts.
 */
export function isRangeBookable(
  range: StayRange,
  quantity: number,
  bookings: StayRange[],
  blocks: BlockRange[],
): boolean {
  if (range.checkOut <= range.checkIn) return false;
  if (blocks.some((b) => halfOpenOverlap(range.checkIn, range.checkOut, b.start, b.end))) {
    return false;
  }
  const overlapping = bookings.filter((bk) =>
    halfOpenOverlap(range.checkIn, range.checkOut, bk.checkIn, bk.checkOut),
  ).length;
  return overlapping < quantity;
}
