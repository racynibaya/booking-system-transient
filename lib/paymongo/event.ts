// Pure parser for the PayMongo `checkout_session.payment.paid` webhook event — NO `server-only`
// import, so it stays unit-testable (same lesson as ./signature). Framework-free (architecture P6).
//
// ⚠️ The field paths here were VALIDATED against a real sandbox event
// (tests/fixtures/paymongo-checkout-paid.json), because the obvious-looking ones are wrong: the
// checkout session's top-level `payments[]` array is EMPTY in the event snapshot. The settled
// amount and a stable reference live on the embedded `payment_intent` instead. The fixture-backed
// unit test (./event.test.ts) locks this so the path can't silently regress.

export type CheckoutPaidEvent = {
  data?: {
    attributes?: {
      type?: string;
      data?: {
        id?: string; // checkout session id (cs_…) — the fallback reference
        attributes?: {
          metadata?: Record<string, string>;
          payment_intent?: { id?: string; attributes?: { amount?: number } };
        };
      };
    };
  };
};

export const CHECKOUT_PAID_EVENT = "checkout_session.payment.paid";

export function isCheckoutPaid(event: CheckoutPaidEvent): boolean {
  return event.data?.attributes?.type === CHECKOUT_PAID_EVENT;
}

export type ParsedCheckoutPaid = {
  bookingId: string | null;
  providerRef: string | null;
  // Settled amount in PESOS (the event carries centavos); undefined when absent so the RPC can
  // fall back to the stamped deposit rather than mis-verify against 0.
  paidPesos: number | undefined;
};

export function parseCheckoutPaid(event: CheckoutPaidEvent): ParsedCheckoutPaid {
  const resource = event.data?.attributes?.data;
  const attrs = resource?.attributes;
  const intent = attrs?.payment_intent;
  const centavos = intent?.attributes?.amount;
  return {
    bookingId: attrs?.metadata?.booking_id ?? null,
    providerRef: intent?.id ?? resource?.id ?? null,
    paidPesos: typeof centavos === "number" ? centavos / 100 : undefined,
  };
}

// Subscription-billing variant — same paid-checkout event, but on the PLATFORM account. It maps to a
// tenant + tier (not a booking) via metadata, and the checkout session id (cs_…) is the idempotency
// key for record_subscription_payment.
export type ParsedSubscriptionCheckoutPaid = {
  kind: string | null; // metadata.kind — "subscription" for this rail
  tenantId: string | null;
  plan: string | null;
  checkoutId: string | null; // cs_… — idempotency key + audit ref
  providerRef: string | null;
  // Settled amount in PESOS (the event carries centavos); undefined when absent.
  paidPesos: number | undefined;
};

export function parseSubscriptionCheckoutPaid(
  event: CheckoutPaidEvent,
): ParsedSubscriptionCheckoutPaid {
  const resource = event.data?.attributes?.data;
  const attrs = resource?.attributes;
  const intent = attrs?.payment_intent;
  const centavos = intent?.attributes?.amount;
  return {
    kind: attrs?.metadata?.kind ?? null,
    tenantId: attrs?.metadata?.tenant_id ?? null,
    plan: attrs?.metadata?.plan ?? null,
    checkoutId: resource?.id ?? null,
    providerRef: intent?.id ?? null,
    paidPesos: typeof centavos === "number" ? centavos / 100 : undefined,
  };
}
