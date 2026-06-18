import { describe, expect, it } from "vitest";

import { effectiveStatus } from "./bookings";

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
