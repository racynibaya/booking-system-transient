import { env } from "@/env";
import { handleVerifiedXenditPayoutEvent } from "@/lib/xendit/payout-webhook-handler";
import { verifyCallbackToken } from "@/lib/xendit/signature";

// Xendit payout webhook — outcome of operator-initiated withdrawals (Slice 4). Registered in Xendit as
// the payout callback URL; same static x-callback-token auth as the account/session webhooks.
// Dormant until XENDIT_CALLBACK_TOKEN is set.
export async function POST(request: Request) {
  if (!env.XENDIT_CALLBACK_TOKEN) {
    return new Response("xendit not configured", { status: 503 });
  }
  if (!verifyCallbackToken(request.headers.get("x-callback-token"), env.XENDIT_CALLBACK_TOKEN)) {
    return new Response("invalid callback token", { status: 401 });
  }
  const rawBody = await request.text();
  return handleVerifiedXenditPayoutEvent(rawBody);
}
