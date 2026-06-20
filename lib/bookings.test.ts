import { describe, expect, it } from "vitest";

import {
  effectiveStatus,
  filterAndSortByView,
  filterByStatus,
  parseBookingFilters,
  viewCounts,
} from "./bookings";

const NOW = Date.parse("2026-06-18T12:00:00Z");
const PAST = "2026-06-18T11:45:00Z";
const FUTURE = "2026-06-18T12:15:00Z";

describe("effectiveStatus", () => {
  it("reports a held booking whose hold has lapsed as expired", () => {
    expect(effectiveStatus("held", PAST, NOW)).toBe("expired");
  });

  it("leaves a held booking with a live hold as held", () => {
    expect(effectiveStatus("held", FUTURE, NOW)).toBe("held");
  });

  it("leaves a held booking with no expiry as held", () => {
    expect(effectiveStatus("held", null, NOW)).toBe("held");
  });

  it("never overrides a non-held status, even with a past timestamp", () => {
    expect(effectiveStatus("awaiting_confirmation", null, NOW)).toBe("awaiting_confirmation");
    expect(effectiveStatus("confirmed", PAST, NOW)).toBe("confirmed");
    expect(effectiveStatus("cancelled", PAST, NOW)).toBe("cancelled");
  });
});

describe("parseBookingFilters", () => {
  it("defaults to the upcoming view with no filters", () => {
    expect(parseBookingFilters({})).toEqual({
      property: undefined,
      room: undefined,
      q: undefined,
      from: undefined,
      to: undefined,
      status: [],
      view: "upcoming",
    });
  });

  it("keeps valid params and drops malformed ones", () => {
    const parsed = parseBookingFilters({
      property: "p1",
      room: "r1",
      q: "  anna  ",
      from: "2026-06-20",
      to: "not-a-date",
      status: "confirmed,bogus,held",
      view: "action",
    });
    expect(parsed.property).toBe("p1");
    expect(parsed.room).toBe("r1");
    expect(parsed.q).toBe("anna");
    expect(parsed.from).toBe("2026-06-20");
    expect(parsed.to).toBeUndefined(); // bad date dropped
    expect(parsed.status).toEqual(["confirmed", "held"]); // unknown status dropped
    expect(parsed.view).toBe("action");
  });

  it("falls back to upcoming for an unknown view and reads the first of array params", () => {
    expect(parseBookingFilters({ view: "nope" }).view).toBe("upcoming");
    expect(parseBookingFilters({ property: ["a", "b"] }).property).toBe("a");
  });
});

// today = 2026-06-20. Rows span staying-now, soon, far-future, and several past buckets.
const TODAY = "2026-06-20";
const ROWS = [
  { id: "A", status: "confirmed" as const, check_in: "2026-06-22", check_out: "2026-06-25" }, // upcoming + soon
  { id: "B", status: "held" as const, check_in: "2026-06-19", check_out: "2026-06-21" }, // staying now: upcoming + soon + action
  {
    id: "C",
    status: "awaiting_confirmation" as const,
    check_in: "2026-07-30",
    check_out: "2026-08-01",
  }, // upcoming, not soon, action
  { id: "D", status: "expired" as const, check_in: "2026-06-10", check_out: "2026-06-12" }, // past (not live)
  { id: "E", status: "confirmed" as const, check_in: "2026-05-01", check_out: "2026-05-03" }, // past (departed)
  { id: "F", status: "cancelled" as const, check_in: "2026-06-25", check_out: "2026-06-27" }, // past (cancelled, even though future)
];

describe("viewCounts", () => {
  it("tallies each smart view, keying upcoming off check-out and excluding dead rows", () => {
    expect(viewCounts(ROWS, TODAY)).toEqual({ upcoming: 3, soon: 2, action: 2, past: 3 });
  });
});

describe("filterAndSortByView", () => {
  const ids = (view: Parameters<typeof filterAndSortByView>[1]) =>
    filterAndSortByView(ROWS, view, TODAY).map((r) => r.id);

  it("upcoming: live + not-yet-departed, soonest check-in first", () => {
    expect(ids("upcoming")).toEqual(["B", "A", "C"]);
  });

  it("soon: upcoming within 7 days", () => {
    expect(ids("soon")).toEqual(["B", "A"]);
  });

  it("action: awaiting before held", () => {
    expect(ids("action")).toEqual(["C", "B"]);
  });

  it("past: everything not upcoming, most recent check-in first", () => {
    expect(ids("past")).toEqual(["F", "D", "E"]);
  });
});

describe("filterByStatus", () => {
  it("returns all rows when no status is selected", () => {
    expect(filterByStatus(ROWS, [])).toHaveLength(ROWS.length);
  });

  it("narrows to the selected statuses", () => {
    expect(filterByStatus(ROWS, ["confirmed"]).map((r) => r.id)).toEqual(["A", "E"]);
    expect(filterByStatus(ROWS, ["expired", "cancelled"]).map((r) => r.id)).toEqual(["D", "F"]);
  });
});
