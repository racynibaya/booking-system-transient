import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";

import { isCheckoutPaid, parseCheckoutPaid, type CheckoutPaidEvent } from "./event";

// The fixture is a REAL sandbox `checkout_session.payment.paid` event captured during the Phase 2a
// live proof. It is the regression lock for the field paths (the top-level payments[] is empty;
// amount + ref live on payment_intent).
const realEvent = JSON.parse(
  readFileSync(resolve(process.cwd(), "tests/fixtures/paymongo-checkout-paid.json"), "utf8"),
) as CheckoutPaidEvent;

describe("parseCheckoutPaid (validated against a real PayMongo event)", () => {
  it("recognizes the checkout_session.payment.paid type", () => {
    expect(isCheckoutPaid(realEvent)).toBe(true);
    expect(isCheckoutPaid({ data: { attributes: { type: "checkout_session.expired" } } })).toBe(
      false,
    );
  });

  it("reads the settled amount from payment_intent (pesos), not the empty payments[]", () => {
    expect(parseCheckoutPaid(realEvent).paidPesos).toBe(2250);
  });

  it("uses the payment_intent id as the provider reference", () => {
    expect(parseCheckoutPaid(realEvent).providerRef).toBe("pi_gnSsXmrExLZcd2SBknJw7CWn");
  });

  it("reads booking_id from metadata", () => {
    expect(parseCheckoutPaid(realEvent).bookingId).toBe("5406d81c-8c02-4064-8a45-69e7c891587f");
  });

  it("degrades safely on a malformed/empty event", () => {
    const r = parseCheckoutPaid({});
    expect(r.bookingId).toBeNull();
    expect(r.providerRef).toBeNull();
    expect(r.paidPesos).toBeUndefined();
  });

  it("falls back to the checkout session id when payment_intent has no id", () => {
    const e: CheckoutPaidEvent = {
      data: { attributes: { type: "checkout_session.payment.paid", data: { id: "cs_fallback" } } },
    };
    expect(parseCheckoutPaid(e).providerRef).toBe("cs_fallback");
  });
});
