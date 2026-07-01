import { env } from "@/env";
import { handleVerifiedXenditSessionEvent } from "@/lib/xendit/session-webhook-handler";
import { verifyCallbackToken } from "@/lib/xendit/signature";

// Xendit Payment Session webhook — guest-payment confirmation for the commission rail (Slice 2c).
// Registered in Xendit as the payment-session callback URL (separate from the account-status webhook at
// ../route.ts, but the same static x-callback-token auth). A `payment_session.completed` event confirms
// the booking via the shared handler → confirm_booking_gateway (p_provider 'xendit', no accrual).
//
// Dormant until XENDIT_CALLBACK_TOKEN is set (dev/CI/current prod boot without it → 503).
export async function POST(request: Request) {
  if (!env.XENDIT_CALLBACK_TOKEN) {
    return new Response("xendit not configured", { status: 503 });
  }

  if (!verifyCallbackToken(request.headers.get("x-callback-token"), env.XENDIT_CALLBACK_TOKEN)) {
    return new Response("invalid callback token", { status: 401 });
  }

  const rawBody = await request.text();
  return handleVerifiedXenditSessionEvent(rawBody);
}
