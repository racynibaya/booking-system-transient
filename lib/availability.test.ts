import { describe, it, expect } from "vitest";
import {
  isAvailable,
  isRangeBookable,
  rangesOverlap,
  unitsAvailableOn,
  type BlockRange,
  type StayRange,
} from "./availability";

const d = (s: string) => new Date(s);

describe("rangesOverlap", () => {
  it("detects overlapping ranges", () => {
    expect(
      rangesOverlap(
        { checkIn: d("2026-10-10"), checkOut: d("2026-10-13") },
        { checkIn: d("2026-10-12"), checkOut: d("2026-10-15") },
      ),
    ).toBe(true);
  });

  it("treats same-day checkout/checkin as non-overlapping (half-open)", () => {
    expect(
      rangesOverlap(
        { checkIn: d("2026-10-10"), checkOut: d("2026-10-12") },
        { checkIn: d("2026-10-12"), checkOut: d("2026-10-14") },
      ),
    ).toBe(false);
  });
});

describe("isAvailable", () => {
  const existing = [{ checkIn: d("2026-10-10"), checkOut: d("2026-10-13") }];

  it("is available when no existing booking overlaps", () => {
    expect(isAvailable({ checkIn: d("2026-10-13"), checkOut: d("2026-10-16") }, existing)).toBe(
      true,
    );
  });

  it("is unavailable when any existing booking overlaps", () => {
    expect(isAvailable({ checkIn: d("2026-10-11"), checkOut: d("2026-10-12") }, existing)).toBe(
      false,
    );
  });
});

describe("unitsAvailableOn", () => {
  const bookings: StayRange[] = [
    { checkIn: "2026-10-10", checkOut: "2026-10-13" }, // occupies 10,11,12
    { checkIn: "2026-10-11", checkOut: "2026-10-12" }, // occupies 11
  ];

  it("subtracts overlapping bookings from quantity per day", () => {
    expect(unitsAvailableOn("2026-10-10", 3, bookings, [])).toBe(2); // 1 booking
    expect(unitsAvailableOn("2026-10-11", 3, bookings, [])).toBe(1); // 2 bookings
    expect(unitsAvailableOn("2026-10-13", 3, bookings, [])).toBe(3); // checkout day free (half-open)
  });

  it("never goes below zero", () => {
    expect(unitsAvailableOn("2026-10-11", 1, bookings, [])).toBe(0);
  });

  it("a block closes the whole room_type for its days", () => {
    const blocks: BlockRange[] = [{ start: "2026-10-20", end: "2026-10-22" }];
    expect(unitsAvailableOn("2026-10-20", 5, [], blocks)).toBe(0);
    expect(unitsAvailableOn("2026-10-21", 5, [], blocks)).toBe(0);
    expect(unitsAvailableOn("2026-10-22", 5, [], blocks)).toBe(5); // end day free (half-open)
  });
});

describe("isRangeBookable (mirrors create_booking_hold)", () => {
  const bookings: StayRange[] = [{ checkIn: "2026-10-10", checkOut: "2026-10-13" }];

  it("rejects an invalid range", () => {
    expect(isRangeBookable({ checkIn: "2026-10-12", checkOut: "2026-10-12" }, 1, [], [])).toBe(
      false,
    );
  });

  it("allows when fewer than quantity bookings overlap", () => {
    expect(
      isRangeBookable({ checkIn: "2026-10-11", checkOut: "2026-10-12" }, 2, bookings, []),
    ).toBe(true);
  });

  it("rejects when overlapping bookings reach quantity", () => {
    expect(
      isRangeBookable({ checkIn: "2026-10-11", checkOut: "2026-10-12" }, 1, bookings, []),
    ).toBe(false);
  });

  it("treats same-day checkout/checkin as non-overlapping (half-open)", () => {
    expect(
      isRangeBookable({ checkIn: "2026-10-13", checkOut: "2026-10-15" }, 1, bookings, []),
    ).toBe(true);
  });

  it("rejects any overlap with a block", () => {
    const blocks: BlockRange[] = [{ start: "2026-10-20", end: "2026-10-25" }];
    expect(isRangeBookable({ checkIn: "2026-10-24", checkOut: "2026-10-27" }, 5, [], blocks)).toBe(
      false,
    );
  });
});
