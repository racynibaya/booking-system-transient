import { describe, it, expect } from "vitest";
import { nights, computeTotal, computeDeposit, meetsMinStay, MIN_STAY_NIGHTS } from "./pricing";

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
});
