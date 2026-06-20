import { env } from "@/env";
import {
  verifyWebhookSignature,
  WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS,
} from "@/lib/paymongo/signature";
import { handleVerifiedPaymongoEvent } from "@/lib/paymongo/webhook-handler";

// PayMongo webhook (Phase 2a spike) — the flat, env-keyed endpoint. A paid Checkout Session lands
// here, we authenticate it with the single env webhook secret, and hand the verified body to the
// shared handler (lib/paymongo/webhook-handler.ts) → confirm_booking_gateway (architecture P7).
//
// SPIKE SCOPE: one endpoint, env webhook secret. Phase 2b's /api/webhooks/paymongo/[token] verifies
// with the per-tenant connection's own whsk_; this flat route stays (dormant) until that is proven,
// then it can be retired. The post-verification logic is identical — both call the shared handler.

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
