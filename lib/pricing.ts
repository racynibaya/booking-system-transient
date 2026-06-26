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

/**
 * Default guest-facing minimum stay, and the fallback when a property's setting isn't loaded.
 * Operators set their own per-property minimum (properties.min_stay_nights, default 2); this
 * constant is the column default and the safe fallback. Enforced server-side in the public
 * booking action (the P5 trust boundary) and mirrored in the booking-card UX. Deliberately NOT a
 * create_booking_hold invariant: operators can still record shorter walk-in/off-platform stays
 * via the manual booking path.
 */
export const MIN_STAY_NIGHTS = 2;

/** Whole nights in a half-open stay. `checkOut` must be after `checkIn`. */
export function nights(checkIn: DateStr, checkOut: DateStr): number {
  const ms = fromDateStr(checkOut).getTime() - fromDateStr(checkIn).getTime();
  return Math.round(ms / MS_PER_DAY); // round() guards any clock drift; Asia/Manila has no DST
}

/**
 * Whether a stay satisfies the guest-facing minimum. Single source of the rule, shared by the
 * public booking action (server enforcement) and the booking-card (UX). `minNights` is the
 * property's setting, defaulting to MIN_STAY_NIGHTS. An inverted/zero range yields <= 0 nights
 * and is rejected too.
 */
export function meetsMinStay(
  checkIn: DateStr,
  checkOut: DateStr,
  minNights: number = MIN_STAY_NIGHTS,
): boolean {
  return nights(checkIn, checkOut) >= minNights;
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

// --- Centralized-aggregator money model ---------------------------------------------------
//
// Tuloy collects the guest's deposit + a service fee into ONE platform PayMongo account, then
// disburses the operator's share to their GCash/bank, keeping ~11% of the full stay (5% operator
// commission + 6% guest service fee). Both fees are sized on the FULL STAY VALUE (S) but collected
// through the DEPOSIT (D) transaction — no full-payment-online required.
//
//   guest pays:  G = (D + serviceFee + PAYMONGO_FIXED) / (1 - PAYMONGO_MDR)   [fee passed through]
//   owner gets:  D - operatorCommission  (deposit payout; + collects S-D at check-in directly)
//   Tuloy keeps: serviceFee + operatorCommission  (≈ 0.11·S)
//
// The PayMongo processing fee is grossed up into the guest's "service fee" line so the operator
// nets their full share. MDR/fixed must be the WORST-CASE enabled method (the guest picks the method
// at checkout, after the amount is fixed) so we never under-cover. The guest checkout enables card
// (createPlatformCheckout), so the worst case is PayMongo's standard DOMESTIC CARD rate: 3.5% + ₱15.
// ⚠️ Confirm against your PayMongo dashboard before go-live (negotiated rates may differ; INTERNATIONAL
// cards are higher at ~4.5% — restrict the checkout to domestic/e-wallets if that exposure matters).
export const PAYMONGO_MDR = 0.035; // 3.5% — PayMongo standard domestic card
export const PAYMONGO_FIXED = 15; // ₱15 — PayMongo standard domestic card fixed fee

export type BookingSplit = {
  stayValue: number; // S
  deposit: number; // D — base for the operator's deposit payout
  serviceFee: number; // guest-borne Tuloy fee, 0.06·S
  operatorCommission: number; // withheld from the deposit payout, 0.05·S
  guestTotal: number; // G — what the guest is charged (deposit + serviceFee + grossed-up PayMongo fee)
  ownerPayout: number; // D − operatorCommission — what Tuloy disburses from the deposit
  tuloyRevenue: number; // serviceFee + operatorCommission ≈ 0.11·S
};

// Single source of truth for the split — used by the guest checkout (guestTotal) and the payout
// ledger (operatorCommission / ownerPayout / serviceFee). `rates` are per-owner (early-adopter
// discount). Caller should ensure deposit ≥ operatorCommission (true for normal deposits ≥ ~30%);
// ownerPayout can go negative otherwise — guard at booking config, not here.
export function computeBookingSplit(
  stayValue: number,
  deposit: number,
  rates: { commissionRate: number; serviceFeeRate: number },
): BookingSplit {
  const serviceFee = round2(stayValue * rates.serviceFeeRate);
  const operatorCommission = round2(stayValue * rates.commissionRate);
  const base = round2(deposit + serviceFee);
  const guestTotal = round2((base + PAYMONGO_FIXED) / (1 - PAYMONGO_MDR));
  return {
    stayValue,
    deposit,
    serviceFee,
    operatorCommission,
    guestTotal,
    ownerPayout: round2(deposit - operatorCommission),
    tuloyRevenue: round2(serviceFee + operatorCommission),
  };
}
