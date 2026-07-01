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

// Early-adopter commission rate (per-operator default; some carry their own on the Xendit account).
// Single source for the earnings ledger's cash/deposit half (M4) until the online rail is live.
// Pilot: 0% founding-operator commission.
export const DEFAULT_COMMISSION_RATE = 0;

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

// --- Xendit xenPlatform commission model (Slice 2) ----------
//
// The guest charge is created ON the operator's sub-account and a Split Rule routes Tuloy's commission
// to the Master AT CAPTURE — funds never pool in a Tuloy balance (no custody). Unlike the aggregator
// (≈11%: 5% operator commission + 6% guest service fee), this is a SINGLE 2.5% commission on the FULL
// STAY (D1), borne by the operator (withheld via the split), with ONLY the Xendit processing fee
// grossed onto the guest (D2). So the guest pays just the deposit + the fee gross-up — cheaper than the
// aggregator (no 6% line) — and Tuloy keeps 2.5%·S.
//
//   commission = 0.025 · S        — flat peso amount routed to Master via the Split Rule
//   guest pays G = (D + XENDIT_FIXED) / (1 − XENDIT_MDR)   — gross up the DEPOSIT for the Xendit fee
//   operator nets = D − commission — settles to their sub-account; they self-withdraw
//   Tuloy keeps   = commission
//
// Pilot: QR Ph is the ONLY enabled guest method (decided 2026-07-01). Xendit PH list rate for QR Ph =
// 1.4% with a ₱15 per-transaction floor, all exclusive of 12% VAT (VAT rides on the fee). Per Xendit's
// answer, the fee + VAT is deducted from the operator's receiving sub-account, and the Split Rule
// routes Tuloy's flat 2.5%·S to Master — so the guest bears the processing fee (grossed onto the
// deposit, D2) and the operator bears the commission. Add GCash (2.3%) later by widening the rate here.
export const XENDIT_MDR = 0.014; // QR Ph percentage, VAT-exclusive
export const XENDIT_MIN_FEE = 15; // QR Ph per-transaction floor (peso), VAT-exclusive
export const XENDIT_VAT = 0.12; // PH value-added tax, added on top of Xendit's fee

// The actual Xendit fee (incl. VAT) on a gross settlement of `gross` pesos — max(rate, floor), then
// VAT. Single source for the gross-up and the reconciliation checks.
export function xenditFee(gross: number): number {
  return round2(Math.max(gross * XENDIT_MDR, XENDIT_MIN_FEE) * (1 + XENDIT_VAT));
}

export type XenditSplit = {
  stayValue: number; // S
  deposit: number; // D — collected online
  commission: number; // Tuloy's 0.025·S, routed to Master (flat) at capture
  guestTotal: number; // G — what the guest is charged (deposit grossed up for the Xendit fee)
  ownerNet: number; // D − commission — settles to the operator's sub-account
  tuloyRevenue: number; // commission
};

// Single source of truth for the Xendit split — used by the guest checkout (guestTotal) and the split
// rule (commission). `commissionRate` is per-operator (tenant_xendit_accounts.commission_rate, default
// 0.025 — early-adopter rate). Caller ensures deposit ≥ commission (true for normal deposits ≥ ~30% of
// a stay whose commission is 2.5%); ownerNet can otherwise go negative — guard at booking config.
export function computeXenditSplit(
  stayValue: number,
  deposit: number,
  commissionRate: number,
): XenditSplit {
  const commission = round2(stayValue * commissionRate);
  // Gross up the deposit so the operator nets exactly D after Xendit's fee+VAT. Percentage regime,
  // unless the fee would fall below the ₱15 floor (cheap stays) — then it's a flat floor+VAT add-on.
  const rateVat = XENDIT_MDR * (1 + XENDIT_VAT);
  let guestTotal = deposit / (1 - rateVat);
  if (guestTotal * XENDIT_MDR < XENDIT_MIN_FEE) {
    guestTotal = deposit + XENDIT_MIN_FEE * (1 + XENDIT_VAT);
  }
  guestTotal = round2(guestTotal);
  return {
    stayValue,
    deposit,
    commission,
    guestTotal,
    ownerNet: round2(deposit - commission),
    tuloyRevenue: commission,
  };
}
