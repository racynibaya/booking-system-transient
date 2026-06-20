import { env } from "@/env";
import { toConfirmationBooking, type NotificationBookingRow } from "@/lib/email/notifications";
import { sendEmail } from "@/lib/email/resend";
import { guestConfirmedEmail } from "@/lib/email/templates";
import { isCheckoutPaid, parseCheckoutPaid, type CheckoutPaidEvent } from "@/lib/paymongo/event";
import { verifyWebhookSignature } from "@/lib/paymongo/signature";
import { createServiceClient } from "@/lib/supabase/server";

// PayMongo webhook (Phase 2a spike). The instant-confirmation seam: a paid Checkout Session lands
// here → we authenticate it, map it back to its booking, and confirm via confirm_booking_gateway
// (the SAME confirm contract as the operator's manual path — architecture P7). Idempotent end to
// end (P10): the RPC no-ops a replayed event, so a duplicate webhook is a 200 with no side effect.
//
// SPIKE SCOPE: one endpoint, env webhook secret, env sandbox key. Phase 2b moves to
// /api/webhooks/paymongo/[token] so the per-tenant connection's own secret verifies the event.
//
// We ALWAYS return 200 for an authenticated, well-formed event (handled, ignored, or idempotent
// no-op) so PayMongo stops retrying; only auth/shape failures return 4xx/5xx.

export async function POST(request: Request) {
  if (!env.PAYMONGO_WEBHOOK_SECRET) {
    // Gateway not configured on this deployment — nothing to verify against.
    return new Response("gateway not configured", { status: 503 });
  }

  // Raw body MUST be read before any JSON parse — the HMAC is over the exact received bytes.
  const rawBody = await request.text();
  const signature = request.headers.get("paymongo-signature");

  if (!verifyWebhookSignature(rawBody, signature, env.PAYMONGO_WEBHOOK_SECRET)) {
    return new Response("invalid signature", { status: 401 });
  }

  let event: CheckoutPaidEvent;
  try {
    event = JSON.parse(rawBody) as CheckoutPaidEvent;
  } catch {
    return new Response("malformed body", { status: 400 });
  }

  // Only a paid checkout confirms a booking; acknowledge everything else so PayMongo stops retrying.
  if (!isCheckoutPaid(event)) {
    return new Response("ignored", { status: 200 });
  }

  // Field paths validated against a real event (lib/paymongo/event.ts): amount + ref come from the
  // embedded payment_intent, NOT the (empty) top-level payments[]. paidPesos is verified against the
  // stamped deposit inside the RPC (bulletproof inv. 3); undefined → RPC trusts the stamped deposit.
  const { bookingId, providerRef, paidPesos } = parseCheckoutPaid(event);

  if (!bookingId) {
    // Authenticated but unusable — log-shaped 200 so we don't trigger endless retries on a bad
    // event; a reconcile sweep (Phase 2b step 10) catches anything genuinely missed.
    return new Response("no booking_id in metadata", { status: 200 });
  }

  const admin = createServiceClient();
  const { data: booking, error } = await admin.rpc("confirm_booking_gateway", {
    p_booking_id: bookingId,
    p_provider: "paymongo",
    p_provider_ref: providerRef ?? undefined,
    // Verified against the stamped deposit inside the RPC; omitted → RPC trusts the stamped deposit.
    p_amount: paidPesos,
    p_raw_payload: event as never,
  });

  if (error) {
    // Classify the failure. PERMANENT business errors (the slot was taken in the gap, the paid
    // amount doesn't match, a bad/cancelled booking) will NEVER succeed on retry — acknowledge with
    // 200 so PayMongo stops hammering us. Everything else (DB/network blip) is transient → 500 so
    // PayMongo retries.
    //
    // SPIKE: SLOT_TAKEN / AMOUNT_MISMATCH mean the guest paid but we can't honor it — Phase 2b wires
    // the operator "refund needed" + guest "you'll be refunded" alerts HERE (inv. 2). For now the
    // reconcile sweep + this acknowledged log are the safety net; a human reads the logs.
    const permanent = ["SLOT_TAKEN", "AMOUNT_MISMATCH", "NOT_CONFIRMABLE", "UNKNOWN_BOOKING"].some(
      (code) => error.message.includes(code),
    );
    return new Response(`confirm failed: ${error.message}`, { status: permanent ? 200 : 500 });
  }

  // Idempotent no-op (replayed event → already confirmed): NULL composite renders as all-null
  // object, so guard on a real field. Nothing to email on a replay.
  if (booking?.id) {
    await sendGuestConfirmation(booking as NotificationBookingRow);
  }

  return new Response("ok", { status: 200 });
}

// Best-effort guest confirmation — never affects the 200 (the booking is already confirmed).
// SPIKE: guest only; the operator notification is wired with the full path in Phase 2b (it needs
// the operator's email via the tenant→auth.users lookup).
async function sendGuestConfirmation(booking: NotificationBookingRow): Promise<void> {
  if (!booking.guest_email) return;
  const { subject, html } = guestConfirmedEmail(toConfirmationBooking(booking));
  await sendEmail({ to: booking.guest_email, subject, html });
}
