import { describe, it, expect } from "vitest";
import {
  computeBookingSplit,
  computeDeposit,
  computeTotal,
  meetsMinStay,
  MIN_STAY_NIGHTS,
  nights,
  PAYMONGO_FIXED,
  PAYMONGO_MDR,
} from "./pricing";

describe("nights", () => {
  it("counts whole nights in a half-open stay", () => {
    expect(nights("2026-10-10", "2026-10-13")).toBe(3);
  });

  it("is 1 for a single night", () => {
    expect(nights("2026-10-10", "2026-10-11")).toBe(1);
  });

  it("crosses month boundaries correctly", () => {
    expect(nights("2026-10-30", "2026-11-02")).toBe(3);
  });
});

describe("computeTotal", () => {
  it("multiplies nightly rate by nights", () => {
    expect(computeTotal(2500, 3)).toBe(7500);
  });

  it("rounds to 2 decimals", () => {
    expect(computeTotal(1499.99, 2)).toBe(2999.98);
  });
});

describe("computeDeposit", () => {
  it("takes the given percent of the total", () => {
    expect(computeDeposit(7500, 50)).toBe(3750);
  });

  it("0% is no deposit", () => {
    expect(computeDeposit(7500, 0)).toBe(0);
  });

  it("100% is the whole total", () => {
    expect(computeDeposit(7500, 100)).toBe(7500);
  });

  it("rounds to 2 decimals (half away from zero, matching Postgres round)", () => {
    // 3333.33 * 30 / 100 = 999.999 → 1000.00
    expect(computeDeposit(3333.33, 30)).toBe(1000);
    // 2500.50 * 50 / 100 = 1250.25
    expect(computeDeposit(2500.5, 50)).toBe(1250.25);
  });
});

describe("meetsMinStay", () => {
  it("the constant is 2 nights", () => {
    expect(MIN_STAY_NIGHTS).toBe(2);
  });

  it("rejects a single night", () => {
    expect(meetsMinStay("2026-10-10", "2026-10-11")).toBe(false);
  });

  it("accepts exactly the minimum", () => {
    expect(meetsMinStay("2026-10-10", "2026-10-12")).toBe(true);
  });

  it("accepts a longer stay", () => {
    expect(meetsMinStay("2026-10-10", "2026-10-15")).toBe(true);
  });

  it("rejects an inverted or zero-length range", () => {
    expect(meetsMinStay("2026-10-12", "2026-10-12")).toBe(false);
    expect(meetsMinStay("2026-10-12", "2026-10-11")).toBe(false);
  });

  it("honors an explicit per-property minimum", () => {
    // minNights = 1 accepts a single night
    expect(meetsMinStay("2026-10-10", "2026-10-11", 1)).toBe(true);
    // minNights = 3 rejects a 2-night stay but accepts 3
    expect(meetsMinStay("2026-10-10", "2026-10-12", 3)).toBe(false);
    expect(meetsMinStay("2026-10-10", "2026-10-13", 3)).toBe(true);
  });
});

// Centralized-aggregator money model: Tuloy take = operator commission + guest service fee, both
// sized on the full stay and collected through the deposit; the PayMongo fee is passed to the guest.
describe("computeBookingSplit", () => {
  const rates = { commissionRate: 0.05, serviceFeeRate: 0.06 };

  it("splits a ₱4,000 stay / ₱2,000 deposit per the decided model", () => {
    const s = computeBookingSplit(4000, 2000, rates);
    expect(s.serviceFee).toBe(240); // 6% of stay
    expect(s.operatorCommission).toBe(200); // 5% of stay
    expect(s.ownerPayout).toBe(1800); // deposit − commission
    expect(s.tuloyRevenue).toBe(440); // service fee + commission ≈ 11% of stay
    // Guest charge grosses up the PayMongo fee: (2000 + 240 + 15) / (1 − 0.035) = 2336.79
    expect(s.guestTotal).toBeCloseTo(2336.79, 2);
  });

  it("reconciles: after PayMongo takes its fee, the wallet holds deposit + service fee", () => {
    const s = computeBookingSplit(4000, 2000, rates);
    const paymongoFee = s.guestTotal * PAYMONGO_MDR + PAYMONGO_FIXED;
    const walletAfterFee = s.guestTotal - paymongoFee;
    expect(walletAfterFee).toBeCloseTo(s.deposit + s.serviceFee, 2);
    expect(walletAfterFee).toBeCloseTo(s.ownerPayout + s.tuloyRevenue, 2);
  });

  it("nets the operator 95% of the full stay (deposit payout + check-in balance)", () => {
    const s = computeBookingSplit(4000, 2000, rates);
    const collectedAtCheckIn = s.stayValue - s.deposit; // paid directly to operator, off-platform
    expect(s.ownerPayout + collectedAtCheckIn).toBeCloseTo(0.95 * s.stayValue, 2);
  });

  it("honors per-owner discounted rates", () => {
    const s = computeBookingSplit(4000, 2000, { commissionRate: 0.025, serviceFeeRate: 0.03 });
    expect(s.operatorCommission).toBe(100);
    expect(s.serviceFee).toBe(120);
    expect(s.tuloyRevenue).toBe(220);
  });
});
