import { describe, it, expect } from "vitest";
import {
  annualMonthsFree,
  chargeFor,
  DISPLAY_PLANS,
  isOverRoomCap,
  monthsFor,
  PLANS,
  wouldExceedRoomCap,
} from "./plans";

describe("isOverRoomCap", () => {
  it("is under cap at the exact limit", () => {
    expect(isOverRoomCap("solo", 4)).toBe(false);
    expect(isOverRoomCap("pro", 15)).toBe(false);
  });

  it("is over cap one room past the limit", () => {
    expect(isOverRoomCap("free", 2)).toBe(true); // free is the 1-room floor
    expect(isOverRoomCap("solo", 5)).toBe(true);
    expect(isOverRoomCap("pro", 16)).toBe(true);
  });

  it("treats a null cap (Business) as always under cap", () => {
    expect(isOverRoomCap("business", 1000)).toBe(false);
  });

  it("is under cap below the limit", () => {
    expect(isOverRoomCap("solo", 0)).toBe(false);
    expect(isOverRoomCap("free", 1)).toBe(false); // exactly at the 1-room floor
  });
});

describe("wouldExceedRoomCap (hard block on room creation)", () => {
  it("blocks the next room when already at the cap", () => {
    expect(wouldExceedRoomCap("solo", 4, 1)).toBe(true);
    expect(wouldExceedRoomCap("pro", 15, 1)).toBe(true);
  });

  it("allows adding while it stays within the cap", () => {
    expect(wouldExceedRoomCap("solo", 3, 1)).toBe(false); // 3 → 4, exactly at cap
    expect(wouldExceedRoomCap("pro", 10, 5)).toBe(false); // 10 → 15, exactly at cap
    expect(wouldExceedRoomCap("solo", 0, 1)).toBe(false);
  });

  it("blocks a multi-unit room type that would cross the cap", () => {
    expect(wouldExceedRoomCap("solo", 3, 2)).toBe(true); // 3 → 5, over 4
  });

  it("never blocks Business (null cap = unlimited)", () => {
    expect(wouldExceedRoomCap("business", 1000, 1000)).toBe(false);
  });

  it("keeps blocking a tenant already over cap (legacy soft-rule rooms)", () => {
    expect(wouldExceedRoomCap("solo", 6, 1)).toBe(true);
  });
});

describe("PLANS", () => {
  it("gates the online gateway to Business only (D-B)", () => {
    expect(PLANS.business.gateway).toBe(true);
    expect(PLANS.free.gateway).toBe(false);
    expect(PLANS.solo.gateway).toBe(false);
    expect(PLANS.pro.gateway).toBe(false);
  });

  it("excludes free (the post-pilot floor) from the pricing grid", () => {
    expect(DISPLAY_PLANS.map((p) => p.id)).toEqual(["solo", "pro", "business"]);
  });

  it("carries each tier's headline perk in its feature copy", () => {
    // Solo's reason over Free is discovery; Pro's reason over Solo is automation (the inquiry-labor
    // wedge) — auto-ack + deposit reminders — backed by a clearly-superior marketplace line.
    expect(PLANS.solo.features).toContain("Listed on the San Juan marketplace");
    expect(PLANS.pro.features).toContain(
      "Auto-acknowledge every inquiry — guests never left waiting",
    );
    expect(PLANS.pro.features).toContain("Automatic deposit reminders — the tool chases, not you");
    expect(PLANS.pro.features).toContain("Featured placement + priority marketplace ranking");
  });

  it("self-serve-charged tiers (solo/pro) carry a numeric priceMonthly", () => {
    expect(PLANS.solo.priceMonthly).toBe(990);
    expect(PLANS.pro.priceMonthly).toBe(2500);
    // free has nothing to pay; business is value-priced/contact-sales → not self-serve-charged.
    expect(PLANS.free.priceMonthly).toBeNull();
    expect(PLANS.business.priceMonthly).toBeNull();
  });

  it("annual price is 10× monthly for solo/pro (2 months free); none for free/business", () => {
    expect(PLANS.solo.priceYearly).toBe(9900);
    expect(PLANS.pro.priceYearly).toBe(25000);
    expect(PLANS.free.priceYearly).toBeNull();
    expect(PLANS.business.priceYearly).toBeNull();
  });
});

describe("billing interval helpers", () => {
  it("monthsFor maps the interval to a period length", () => {
    expect(monthsFor("month")).toBe(1);
    expect(monthsFor("year")).toBe(12);
  });

  it("chargeFor returns the price for the interval, or null when not self-serve at it", () => {
    expect(chargeFor("solo", "month")).toBe(990);
    expect(chargeFor("solo", "year")).toBe(9900);
    expect(chargeFor("pro", "year")).toBe(25000);
    expect(chargeFor("business", "year")).toBeNull(); // contact-sales
    expect(chargeFor("free", "month")).toBeNull();
  });

  it("annualMonthsFree is 2 for the discounted tiers, 0 where there's no annual price", () => {
    expect(annualMonthsFree("solo")).toBe(2);
    expect(annualMonthsFree("pro")).toBe(2);
    expect(annualMonthsFree("business")).toBe(0);
    expect(annualMonthsFree("free")).toBe(0);
  });
});
