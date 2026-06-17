/**
 * Pure deposit/total math (F1.4). Dependency-free so it's trivially unit-testable.
 *
 * The DB is server-authoritative: create_booking_hold stamps total_amount/deposit_amount
 * at hold time (architecture P5). This module MIRRORS that SQL so the public booking page
 * can show the guest the same figures the RPC will record. Guarded by a TS↔RPC parity test
 * (same discipline as lib/availability.ts ↔ create_booking_hold).
 *
 * Stays are half-open [checkIn, checkOut): nights = whole days between the two dates
 * (10th → 13th = 3 nights). Money is rounded to 2 decimals to match numeric(10,2).
 */
import { fromDateStr, type DateStr } from "./dates";

const MS_PER_DAY = 86_400_000;

/** Whole nights in a half-open stay. `checkOut` must be after `checkIn`. */
export function nights(checkIn: DateStr, checkOut: DateStr): number {
  const ms = fromDateStr(checkOut).getTime() - fromDateStr(checkIn).getTime();
  return Math.round(ms / MS_PER_DAY); // round() guards any clock drift; Asia/Manila has no DST
}

/** Stay total = nightly rate × nights, rounded to 2 decimals (mirrors numeric(10,2)). */
export function computeTotal(basePrice: number, nightCount: number): number {
  return round2(basePrice * nightCount);
}

/**
 * Deposit = total × percent / 100, rounded to 2 decimals. `percent` is 0–100.
 * Matches Postgres `round(total * percent / 100.0, 2)`.
 */
export function computeDeposit(total: number, percent: number): number {
  return round2((total * percent) / 100);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
