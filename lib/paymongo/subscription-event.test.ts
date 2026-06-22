import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";

import { isCheckoutPaid, parseSubscriptionCheckoutPaid, type CheckoutPaidEvent } from "./event";

// A subscription-shaped `checkout_session.payment.paid` event (PLATFORM account), modeled on the real
// 2a sandbox fixture but with subscription metadata (kind/tenant_id/plan). Locks the field paths used
// by the subscription webhook handler.
const subEvent = JSON.parse(
  readFileSync(resolve(process.cwd(), "tests/fixtures/paymongo-subscription-paid.json"), "utf8"),
) as CheckoutPaidEvent;

describe("parseSubscriptionCheckoutPaid", () => {
  it("recognizes the paid event type", () => {
    expect(isCheckoutPaid(subEvent)).toBe(true);
  });

  it("reads kind, tenant_id and plan from metadata", () => {
    const r = parseSubscriptionCheckoutPaid(subEvent);
    expect(r.kind).toBe("subscription");
    expect(r.tenantId).toBe("6fe52349-0be9-4261-9e8c-483ce2a0ae23");
    expect(r.plan).toBe("solo");
  });

  it("uses the checkout session id as the idempotency key", () => {
    expect(parseSubscriptionCheckoutPaid(subEvent).checkoutId).toBe(
      "cs_sub_140b08a1ea641ddcc5d29b58",
    );
  });

  it("reads the settled amount from payment_intent in pesos", () => {
    expect(parseSubscriptionCheckoutPaid(subEvent).paidPesos).toBe(990);
  });

  it("uses the payment_intent id as the provider reference", () => {
    expect(parseSubscriptionCheckoutPaid(subEvent).providerRef).toBe(
      "pi_sub_gnSsXmrExLZcd2SBknJw7CWn",
    );
  });

  it("degrades safely on a malformed/empty event", () => {
    const r = parseSubscriptionCheckoutPaid({});
    expect(r.kind).toBeNull();
    expect(r.tenantId).toBeNull();
    expect(r.plan).toBeNull();
    expect(r.checkoutId).toBeNull();
    expect(r.paidPesos).toBeUndefined();
  });
});
