import { env } from "@/env";
import { handleVerifiedXenditRefundEvent } from "@/lib/xendit/refund-webhook-handler";
import { verifyCallbackToken } from "@/lib/xendit/signature";

// Xendit refund webhook — outcome of refunds drawn from an operator's sub-account (Slice 3). Registered
// in Xendit as the refund callback URL; same static x-callback-token auth as the other Xendit webhooks.
// Dormant until XENDIT_CALLBACK_TOKEN is set.
export async function POST(request: Request) {
  if (!env.XENDIT_CALLBACK_TOKEN) {
    return new Response("xendit not configured", { status: 503 });
  }
  if (!verifyCallbackToken(request.headers.get("x-callback-token"), env.XENDIT_CALLBACK_TOKEN)) {
    return new Response("invalid callback token", { status: 401 });
  }
  const rawBody = await request.text();
  return handleVerifiedXenditRefundEvent(rawBody);
}
