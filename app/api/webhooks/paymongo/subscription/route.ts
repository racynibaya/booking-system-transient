import { env } from "@/env";
import {
  verifyWebhookSignature,
  WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS,
} from "@/lib/paymongo/signature";
import { handleVerifiedSubscriptionEvent } from "@/lib/paymongo/subscription-webhook-handler";

// PayMongo webhook for OPERATOR SUBSCRIPTION billing — on Tuloy's PLATFORM account. A paid
// subscription checkout lands here; we authenticate it with the platform webhook secret and hand the
// verified body to the subscription handler → record_subscription_payment (plan flips, paid_until
// advances). A separate endpoint + secret from the guest-deposit webhooks: different PayMongo
// account, different rail. Post-verification logic mirrors the booking handler (architecture P7/P10).

export async function POST(request: Request) {
  if (!env.PAYMONGO_PLATFORM_WEBHOOK_SECRET) {
    // Subscription billing not configured on this deployment — nothing to verify against.
    return new Response("subscription billing not configured", { status: 503 });
  }

  // Raw body MUST be read before any JSON parse — the HMAC is over the exact received bytes.
  const rawBody = await request.text();
  const signature = request.headers.get("paymongo-signature");

  if (
    !verifyWebhookSignature(rawBody, signature, env.PAYMONGO_PLATFORM_WEBHOOK_SECRET, {
      toleranceSeconds: WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS,
    })
  ) {
    return new Response("invalid signature", { status: 401 });
  }

  return handleVerifiedSubscriptionEvent(rawBody);
}
