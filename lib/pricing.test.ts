import { describe, it, expect } from "vitest";
import {
  computeDeposit,
  computeTotal,
  computeXenditSplit,
  meetsMinStay,
  MIN_STAY_NIGHTS,
  nights,
  xenditFee,
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

describe("computeXenditSplit", () => {
  it("splits a ₱4,000 stay / ₱2,000 deposit at the 2.5% early-adopter rate", () => {
    const s = computeXenditSplit(4000, 2000, 0.025);
    expect(s.commission).toBe(100); // 2.5% of the FULL stay (D1)
    expect(s.ownerNet).toBe(1900); // deposit − commission, settles to the sub-account
    expect(s.tuloyRevenue).toBe(100); // commission only — no 6% service fee (cheaper than aggregator)
    // Guest pays just the deposit, grossed up for QR Ph's fee (1.4% + 12% VAT): 2000 / (1 − 0.01568)
    expect(s.guestTotal).toBeCloseTo(2031.86, 2);
  });

  it("reconciles: after Xendit's fee, net settled = operator net + commission", () => {
    const s = computeXenditSplit(4000, 2000, 0.025);
    const settledAfterFee = s.guestTotal - xenditFee(s.guestTotal);
    expect(settledAfterFee).toBeCloseTo(s.deposit, 1);
    expect(settledAfterFee).toBeCloseTo(s.ownerNet + s.commission, 1);
  });

  it("applies the ₱15 fee floor (+ VAT) on a cheap deposit", () => {
    // 600 grossed at 1.4% would produce a fee below the ₱15 floor → flat floor+VAT add-on.
    const s = computeXenditSplit(1200, 600, 0.025);
    expect(s.guestTotal).toBeCloseTo(616.8, 2); // 600 + 15·1.12
    expect(s.guestTotal - xenditFee(s.guestTotal)).toBeCloseTo(600, 1);
  });

  it("nets the operator 97.5% of the full stay (sub-account net + check-in balance)", () => {
    const s = computeXenditSplit(4000, 2000, 0.025);
    const collectedAtCheckIn = s.stayValue - s.deposit; // paid directly to the operator, off-platform
    expect(s.ownerNet + collectedAtCheckIn).toBeCloseTo(0.975 * s.stayValue, 2);
  });

  it("sizes commission on the full stay, not the deposit (anti-gaming, D1)", () => {
    // Halving the deposit must NOT shrink Tuloy's commission — it stays 2.5% of the stay.
    const full = computeXenditSplit(4000, 2000, 0.025);
    const tinyDeposit = computeXenditSplit(4000, 500, 0.025);
    expect(tinyDeposit.commission).toBe(full.commission);
  });
});
