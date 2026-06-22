import {
  isCheckoutPaid,
  parseSubscriptionCheckoutPaid,
  type CheckoutPaidEvent,
} from "@/lib/paymongo/event";
import { PLANS, type PlanId } from "@/lib/plans";
import { createServiceClient } from "@/lib/supabase/server";

// Shared subscription-billing webhook body — everything AFTER signature verification, for the
// PLATFORM PayMongo account (operators paying Tuloy). A deliberate SIBLING of
// handleVerifiedPaymongoEvent: that one is money-critical, booking-specific code (guest deposits) and
// is left untouched; this one maps a paid checkout to a tenant + tier via metadata and records it
// idempotently (record_subscription_payment) → plan flips, paid_until advances.
//
// Same response discipline as the booking handler: ALWAYS 200 for a well-formed event (handled,
// ignored, or idempotent no-op) so PayMongo stops retrying; only a malformed shape (400) or a
// transient DB failure (500) is non-200.
export async function handleVerifiedSubscriptionEvent(rawBody: string): Promise<Response> {
  let event: CheckoutPaidEvent;
  try {
    event = JSON.parse(rawBody) as CheckoutPaidEvent;
  } catch {
    return new Response("malformed body", { status: 400 });
  }

  // Only a paid checkout advances a subscription; acknowledge everything else so PayMongo stops.
  if (!isCheckoutPaid(event)) {
    return new Response("ignored", { status: 200 });
  }

  const { kind, tenantId, plan, checkoutId, providerRef, paidPesos } =
    parseSubscriptionCheckoutPaid(event);

  // Defend the rail boundary: only events our subscription checkout minted (metadata.kind) belong
  // here. Anything else on this endpoint is authenticated-but-not-ours — acknowledge and ignore.
  if (kind !== "subscription") {
    return new Response("not a subscription checkout", { status: 200 });
  }

  // Unusable event: missing the fields we need to credit the right tenant/tier. Acknowledge (200) so
  // PayMongo stops retrying; a human reads the log. Validate plan against the source of truth.
  if (!tenantId || !checkoutId || !plan || !(plan in PLANS)) {
    console.error(
      `[paymongo:subscription] unusable event tenant=${tenantId} plan=${plan} checkout=${checkoutId}`,
    );
    return new Response("unusable subscription event", { status: 200 });
  }

  const planId = plan as PlanId;
  // Record the actual settled amount; fall back to the plan's list price if the event omits it.
  const amount = paidPesos ?? PLANS[planId].priceMonthly ?? 0;

  const admin = createServiceClient();
  const { error } = await admin.rpc("record_subscription_payment", {
    p_tenant_id: tenantId,
    p_plan: planId,
    p_amount: amount,
    p_checkout_id: checkoutId,
    p_provider_ref: providerRef ?? undefined,
    p_raw: event as never,
  });

  if (error) {
    // UNKNOWN_TENANT is permanent — never succeeds on retry, so acknowledge (200) and log. Anything
    // else (DB/network blip) is transient → 500 so PayMongo retries.
    const permanent = error.message.includes("UNKNOWN_TENANT");
    return new Response(`record failed: ${error.message}`, { status: permanent ? 200 : 500 });
  }

  // Success: a NEW payment recorded (plan activated, paid_until advanced) OR a replayed checkout
  // (record_subscription_payment no-ops on the duplicate). Both are a clean, idempotent 200.
  return new Response("ok", { status: 200 });
}
