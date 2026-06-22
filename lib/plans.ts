// Single source of truth for subscription tiers. BOTH enforcement (room caps) and the
// landing-page pricing display read from here, so caps/prices can never drift between the
// tier guard and the marketing copy.
//
// Tiers are gated by ROOM COUNT (sum of room_types.quantity) — not property count: a hotel is
// one property with many rooms, so property count would wrongly put a big hotel in the cheapest
// tier (B7/D7). Subscription only; no per-booking commission, ever (D8).

export type PlanId = "free" | "solo" | "pro" | "business";

export type Plan = {
  id: PlanId;
  /** Display name on the pricing grid. */
  label: string;
  blurb: string;
  /**
   * Monthly price as display text. Business is value-priced per hotel; the final figure is
   * DISPLAY-ONLY until charging begins (the pilot is free, enforcement is deferred). One number,
   * one place — change it here, decide it later with real data (D-C).
   */
  price: string;
  /**
   * Monthly price in PESOS, for the self-serve subscription checkout (Phase A). The `price` string
   * above is display copy; this is the number the PayMongo checkout charges. `null` = not
   * self-serve-charged here (free has nothing to pay; business is value-priced/contact-sales).
   */
  priceMonthly: number | null;
  /** Max rooms (sum of room_types.quantity) before the upgrade nudge fires. null = unlimited. */
  roomCap: number | null;
  /**
   * Online card / multi-method gateway is BUSINESS-ONLY (D-B). Solo/Pro are GCash-plus-proof.
   * The 2b gateway gate keys on plan === "business"; adding solo/pro must not unlock it.
   */
  gateway: boolean;
  inherits?: string;
  features: string[];
  highlight?: boolean;
};

export const PLANS: Record<PlanId, Plan> = {
  // The pilot / unpaid default a tenant signs up on. Not a sold plan (excluded from the pricing
  // grid). Capped at the Solo size so an operator who outgrows a small transient gets nudged to
  // pick a paid plan — never blocked (the guard is grace + nudge, D7).
  free: {
    id: "free",
    label: "Free",
    blurb: "Pilot — try everything.",
    price: "₱0",
    priceMonthly: null,
    roomCap: 4,
    gateway: false,
    features: [],
  },
  solo: {
    id: "solo",
    label: "Solo",
    blurb: "A small transient.",
    price: "₱990",
    priceMonthly: 990,
    roomCap: 4,
    gateway: false,
    features: [
      "Up to 4 rooms",
      "Live booking calendar",
      "GCash deposits with proof upload",
      "Your own shareable booking page",
    ],
  },
  pro: {
    id: "pro",
    label: "Pro",
    blurb: "A guesthouse or small hotel.",
    price: "₱2,500",
    priceMonthly: 2500,
    roomCap: 15,
    gateway: false,
    inherits: "Everything in Solo, plus",
    features: [
      "Up to 15 rooms · multiple properties",
      "No double-bookings, guaranteed",
      "Full booking management",
      "Verified operator badge",
    ],
    highlight: true,
  },
  business: {
    id: "business",
    label: "Business",
    blurb: "A full hotel.",
    price: "₱5,900",
    priceMonthly: null,
    roomCap: null,
    gateway: true,
    inherits: "Everything in Pro, plus",
    features: [
      "Unlimited rooms",
      "Multiple payment methods",
      "Priority support",
      "Channel sync — coming soon",
    ],
  },
};

/**
 * The paid tiers shown on the landing page, in display order. `free` is the signup default, not
 * a sold plan, so it is excluded from the pricing grid.
 */
export const DISPLAY_PLANS: Plan[] = [PLANS.solo, PLANS.pro, PLANS.business];

/**
 * Pure cap math (unit-tested before the room-cap guard wires it in). Returns whether a tenant's
 * total room count exceeds their plan's cap — the basis for the soft grace + nudge, never a hard
 * block (D7). `null` cap (Business) is always under cap.
 */
export function isOverRoomCap(planId: PlanId, totalRooms: number): boolean {
  const cap = PLANS[planId].roomCap;
  return cap !== null && totalRooms > cap;
}
