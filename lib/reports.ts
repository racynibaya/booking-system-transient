/**
 * Pure operator-report math (P3.3 basic reporting). Dependency-free so it's unit-testable, same
 * discipline as lib/availability.ts and lib/pricing.ts. Works on YYYY-MM-DD strings; revenue is
 * summed from the payments record (the money source of truth), not bookings.total_amount.
 */
import { fromDateStr, toDateStr, type DateStr } from "./dates";

const MS_PER_DAY = 86_400_000;

/** Half-open current-month range [start, end) as YYYY-MM-DD, from a reference date. */
export function monthRange(today: DateStr): { start: DateStr; end: DateStr } {
  const d = fromDateStr(today);
  return {
    start: toDateStr(new Date(d.getFullYear(), d.getMonth(), 1)),
    end: toDateStr(new Date(d.getFullYear(), d.getMonth() + 1, 1)),
  };
}

/**
 * Half-open current-week range [start, end) as YYYY-MM-DD, from a reference date. Week starts
 * Monday (PH convention) and `end` is the following Monday — so "collected this week" is the
 * calendar week the operator is living in, not a rolling 7-day window.
 */
export function weekRange(today: DateStr): { start: DateStr; end: DateStr } {
  const d = fromDateStr(today);
  const dow = d.getDay(); // 0=Sun … 6=Sat
  const sinceMonday = (dow + 6) % 7; // Mon→0, Sun→6
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() - sinceMonday);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
  return { start: toDateStr(start), end: toDateStr(end) };
}

/** Whole days in a half-open [start, end) range — the available nights per room. */
export function daysInRange(start: DateStr, end: DateStr): number {
  return Math.round((fromDateStr(end).getTime() - fromDateStr(start).getTime()) / MS_PER_DAY);
}

/**
 * Nights of a single stay that fall inside [start, end), half-open. A booking occupies one unit,
 * so this is its room-night contribution to the window. Clips the stay to the window first
 * (string compare on ISO dates is chronological — no timezone shift).
 */
export function nightsInRange(
  checkIn: DateStr,
  checkOut: DateStr,
  start: DateStr,
  end: DateStr,
): number {
  const from = checkIn > start ? checkIn : start;
  const to = checkOut < end ? checkOut : end;
  if (to <= from) return 0;
  return Math.round((fromDateStr(to).getTime() - fromDateStr(from).getTime()) / MS_PER_DAY);
}

export type StayDates = { check_in: DateStr; check_out: DateStr };

/** Total room-nights booked within [start, end) across the given stays. */
export function bookedRoomNights(stays: StayDates[], start: DateStr, end: DateStr): number {
  return stays.reduce((sum, s) => sum + nightsInRange(s.check_in, s.check_out, start, end), 0);
}

/** Occupancy % = booked room-nights / (rooms × days), rounded and clamped to [0, 100]. */
export function occupancyPct(bookedNights: number, rooms: number, days: number): number {
  const capacity = rooms * days;
  if (capacity <= 0) return 0;
  return Math.min(100, Math.round((bookedNights / capacity) * 100));
}
