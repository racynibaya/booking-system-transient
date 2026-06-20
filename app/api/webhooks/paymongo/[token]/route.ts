import {
  verifyWebhookSignature,
  WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS,
} from "@/lib/paymongo/signature";
import { handleVerifiedPaymongoEvent } from "@/lib/paymongo/webhook-handler";
import { getGatewayConnectionByToken } from "@/lib/supabase/gateway-dal";

// Per-tenant PayMongo webhook (Phase 2b / M3). Each operator-as-merchant connection registers its
// own webhook at /api/webhooks/paymongo/{token}, where {token} is the connection's opaque
// webhook_token (routing id, NOT a secret). We look the connection up by that token and verify the
// event with THAT tenant's whsk_, then hand the verified body to the shared handler — same confirm
// contract, idempotency, and 200/4xx/5xx classification as the flat 2a route (architecture P7).

export async function POST(request: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;

  // Raw body MUST be read before any JSON parse — the HMAC is over the exact received bytes.
  const rawBody = await request.text();
  const signature = request.headers.get("paymongo-signature");

  const connection = await getGatewayConnectionByToken(token);
  if (!connection) {
    // Unknown/retired token — no tenant owns it. 404 (not 401): there's nothing to verify against.
    return new Response("unknown webhook token", { status: 404 });
  }

  if (
    !verifyWebhookSignature(rawBody, signature, connection.whsk, {
      toleranceSeconds: WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS,
    })
  ) {
    return new Response("invalid signature", { status: 401 });
  }

  return handleVerifiedPaymongoEvent(rawBody);
}
