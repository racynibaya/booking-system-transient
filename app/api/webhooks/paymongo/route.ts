import { env } from "@/env";
import {
  verifyWebhookSignature,
  WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS,
} from "@/lib/paymongo/signature";
import { handleVerifiedPaymongoEvent } from "@/lib/paymongo/webhook-handler";

// PayMongo webhook — the flat, env-keyed endpoint. In the centralized-aggregator model ALL guest
// payments are collected into the ONE Tuloy platform account, so a single webhook (registered on that
// account) verified with the single env webhook secret (PAYMONGO_WEBHOOK_SECRET = the platform
// account's whsk_) handles every paid Checkout Session. The verified body goes to the shared handler
// (lib/paymongo/webhook-handler.ts) → confirm_booking_gateway (architecture P7), which verifies the
// settled amount against the booking's stamped gateway_charge_amount (the grossed-up charge).
//
// The dormant Model-A path (/api/webhooks/paymongo/[token], per-tenant whsk_) is unchanged and shares
// this exact handler — same confirm contract, idempotency, and 200/4xx/5xx classification.

export async function POST(request: Request) {
  if (!env.PAYMONGO_WEBHOOK_SECRET) {
    // Gateway not configured on this deployment — nothing to verify against.
    return new Response("gateway not configured", { status: 503 });
  }

  // Raw body MUST be read before any JSON parse — the HMAC is over the exact received bytes.
  const rawBody = await request.text();
  const signature = request.headers.get("paymongo-signature");

  if (
    !verifyWebhookSignature(rawBody, signature, env.PAYMONGO_WEBHOOK_SECRET, {
      toleranceSeconds: WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS,
    })
  ) {
    return new Response("invalid signature", { status: 401 });
  }

  return handleVerifiedPaymongoEvent(rawBody);
}
