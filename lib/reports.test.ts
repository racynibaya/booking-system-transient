import { describe, it, expect } from "vitest";
import {
  monthRange,
  weekRange,
  daysInRange,
  nightsInRange,
  bookedRoomNights,
  occupancyPct,
} from "./reports";

describe("monthRange", () => {
  it("returns the half-open [first, next-first) bounds of the month", () => {
    expect(monthRange("2026-06-21")).toEqual({ start: "2026-06-01", end: "2026-07-01" });
  });
  it("rolls over December to next January", () => {
    expect(monthRange("2026-12-15")).toEqual({ start: "2026-12-01", end: "2027-01-01" });
  });
});

describe("weekRange", () => {
  it("returns Monday→next Monday from a midweek date", () => {
    // 2026-06-21 is a Sunday; its week started Mon 2026-06-15.
    expect(weekRange("2026-06-21")).toEqual({ start: "2026-06-15", end: "2026-06-22" });
  });
  it("treats Monday as the first day of its own week", () => {
    expect(weekRange("2026-06-15")).toEqual({ start: "2026-06-15", end: "2026-06-22" });
  });
  it("rolls a week across a month boundary", () => {
    // 2026-07-01 is a Wednesday; week started Mon 2026-06-29.
    expect(weekRange("2026-07-01")).toEqual({ start: "2026-06-29", end: "2026-07-06" });
  });
});

describe("daysInRange", () => {
  it("counts whole days in June (30)", () => {
    expect(daysInRange("2026-06-01", "2026-07-01")).toBe(30);
  });
});

describe("nightsInRange", () => {
  it("counts a stay fully inside the window", () => {
    expect(nightsInRange("2026-06-10", "2026-06-13", "2026-06-01", "2026-07-01")).toBe(3);
  });
  it("clips a stay that overhangs the window start", () => {
    expect(nightsInRange("2026-05-29", "2026-06-03", "2026-06-01", "2026-07-01")).toBe(2);
  });
  it("clips a stay that overhangs the window end", () => {
    expect(nightsInRange("2026-06-29", "2026-07-04", "2026-06-01", "2026-07-01")).toBe(2);
  });
  it("returns 0 for a stay entirely outside the window", () => {
    expect(nightsInRange("2026-08-01", "2026-08-05", "2026-06-01", "2026-07-01")).toBe(0);
  });
});

describe("bookedRoomNights", () => {
  it("sums clipped nights across stays (each stay = one unit)", () => {
    const stays = [
      { check_in: "2026-06-10", check_out: "2026-06-13" }, // 3
      { check_in: "2026-06-29", check_out: "2026-07-02" }, // 2 clipped
      { check_in: "2026-08-01", check_out: "2026-08-03" }, // 0
    ];
    expect(bookedRoomNights(stays, "2026-06-01", "2026-07-01")).toBe(5);
  });
});

describe("occupancyPct", () => {
  it("computes a rounded percentage", () => {
    // 15 booked of (2 rooms × 30 days = 60) = 25%
    expect(occupancyPct(15, 2, 30)).toBe(25);
  });
  it("returns 0 when there are no rooms", () => {
    expect(occupancyPct(10, 0, 30)).toBe(0);
  });
  it("clamps over-full windows to 100", () => {
    expect(occupancyPct(100, 1, 30)).toBe(100);
  });
});
