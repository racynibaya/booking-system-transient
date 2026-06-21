import { describe, expect, it } from "vitest";

import {
  effectiveStatus,
  filterAndSortByView,
  filterByStatus,
  isNewRequest,
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
// created_at / hold_expires_at only matter for the Needs-action urgency sort (B & C below).
const TODAY = "2026-06-20";
const ROWS = [
  {
    id: "A",
    status: "confirmed" as const,
    check_in: "2026-06-22",
    check_out: "2026-06-25",
    created_at: "2026-06-15T00:00:00Z",
    hold_expires_at: null,
  }, // upcoming + soon
  {
    id: "B",
    status: "held" as const,
    check_in: "2026-06-19",
    check_out: "2026-06-21",
    created_at: "2026-06-19T08:00:00Z",
    hold_expires_at: "2026-06-19T08:30:00Z",
  }, // staying now: upcoming + soon + action; hold clock = Jun 19 08:30
  {
    id: "C",
    status: "awaiting_confirmation" as const,
    check_in: "2026-07-30",
    check_out: "2026-08-01",
    created_at: "2026-06-20T06:00:00Z", // response clock = Jun 21 06:00 (beats the far check_in)
    hold_expires_at: null,
  }, // upcoming, not soon, action
  {
    id: "D",
    status: "expired" as const,
    check_in: "2026-06-10",
    check_out: "2026-06-12",
    created_at: "2026-06-09T00:00:00Z",
    hold_expires_at: null,
  }, // past (not live)
  {
    id: "E",
    status: "confirmed" as const,
    check_in: "2026-05-01",
    check_out: "2026-05-03",
    created_at: "2026-04-28T00:00:00Z",
    hold_expires_at: null,
  }, // past (departed)
  {
    id: "F",
    status: "cancelled" as const,
    check_in: "2026-06-25",
    check_out: "2026-06-27",
    created_at: "2026-06-21T00:00:00Z",
    hold_expires_at: null,
  }, // past (cancelled, even though future)
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

  it("action: most urgent first — B's hold clock (Jun 19) beats C's response clock (Jun 21)", () => {
    expect(ids("action")).toEqual(["B", "C"]);
  });

  it("past: everything not upcoming, most recent check-in first", () => {
    expect(ids("past")).toEqual(["F", "D", "E"]);
  });
});

describe("filterAndSortByView — action urgency", () => {
  // min(created_at + 24h, arrival), soonest first; held races hold_expires_at, others race check_in.
  const ACTION_ROWS = [
    {
      id: "freshFar", // created today, stay far off → response clock = Jun 21 11:00
      status: "awaiting_confirmation" as const,
      check_in: "2026-08-20",
      check_out: "2026-08-22",
      created_at: "2026-06-20T11:00:00Z",
      hold_expires_at: null,
    },
    {
      id: "held", // hold expires in 30 min → hold clock = Jun 20 12:00
      status: "held" as const,
      check_in: "2026-09-01",
      check_out: "2026-09-03",
      created_at: "2026-06-20T11:30:00Z",
      hold_expires_at: "2026-06-20T12:00:00Z",
    },
    {
      id: "overdue", // created 2 days ago → response clock = Jun 19 12:00 (already overdue)
      status: "awaiting_confirmation" as const,
      check_in: "2026-06-23",
      check_out: "2026-06-25",
      created_at: "2026-06-18T12:00:00Z",
      hold_expires_at: null,
    },
  ];

  it("orders by soonest deadline: overdue response < held's hold clock < fresh far-stay", () => {
    expect(filterAndSortByView(ACTION_ROWS, "action", TODAY).map((r) => r.id)).toEqual([
      "overdue",
      "held",
      "freshFar",
    ]);
  });
});

describe("isNewRequest", () => {
  it("flags a request created inside the response window", () => {
    expect(isNewRequest(new Date().toISOString())).toBe(true);
  });

  it("clears once a request ages past the window", () => {
    expect(isNewRequest("2020-01-01T00:00:00Z")).toBe(false);
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
