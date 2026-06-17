import { describe, it, expect } from "vitest";

import { addDays, fromDateStr, toDateStr } from "./dates";

describe("date string helpers", () => {
  it("round-trips a date string without shifting the day", () => {
    expect(toDateStr(fromDateStr("2026-10-10"))).toBe("2026-10-10");
  });

  it("fromDateStr builds the literal calendar day (no UTC off-by-one)", () => {
    const d = fromDateStr("2026-10-10");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(9); // October (0-indexed)
    expect(d.getDate()).toBe(10);
  });

  it("addDays crosses month boundaries", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("ISO date strings sort chronologically", () => {
    expect("2026-10-09" < "2026-10-10").toBe(true);
    expect("2026-02-01" < "2026-10-01").toBe(true);
  });
});
