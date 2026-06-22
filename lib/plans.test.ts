import { describe, it, expect } from "vitest";
import { isOverRoomCap, PLANS, DISPLAY_PLANS } from "./plans";

describe("isOverRoomCap", () => {
  it("is under cap at the exact limit", () => {
    expect(isOverRoomCap("solo", 4)).toBe(false);
    expect(isOverRoomCap("pro", 15)).toBe(false);
  });

  it("is over cap one room past the limit", () => {
    expect(isOverRoomCap("free", 5)).toBe(true);
    expect(isOverRoomCap("solo", 5)).toBe(true);
    expect(isOverRoomCap("pro", 16)).toBe(true);
  });

  it("treats a null cap (Business) as always under cap", () => {
    expect(isOverRoomCap("business", 1000)).toBe(false);
  });

  it("is under cap below the limit", () => {
    expect(isOverRoomCap("solo", 0)).toBe(false);
    expect(isOverRoomCap("free", 3)).toBe(false);
  });
});

describe("PLANS", () => {
  it("gates the online gateway to Business only (D-B)", () => {
    expect(PLANS.business.gateway).toBe(true);
    expect(PLANS.free.gateway).toBe(false);
    expect(PLANS.solo.gateway).toBe(false);
    expect(PLANS.pro.gateway).toBe(false);
  });

  it("excludes the free signup default from the pricing grid", () => {
    expect(DISPLAY_PLANS.map((p) => p.id)).toEqual(["solo", "pro", "business"]);
  });

  it("self-serve-charged tiers (solo/pro) carry a numeric priceMonthly", () => {
    expect(PLANS.solo.priceMonthly).toBe(990);
    expect(PLANS.pro.priceMonthly).toBe(2500);
    // free has nothing to pay; business is value-priced/contact-sales → not self-serve-charged.
    expect(PLANS.free.priceMonthly).toBeNull();
    expect(PLANS.business.priceMonthly).toBeNull();
  });
});
