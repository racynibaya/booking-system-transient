import { env } from "@/env";
import { verifyCallbackToken } from "@/lib/xendit/signature";
import { handleVerifiedXenditAccountEvent } from "@/lib/xendit/webhook-handler";

// Xendit xenPlatform account-status webhook — the env-keyed endpoint for MANAGED sub-account KYC
// lifecycle (account.registered/activated/suspended → tenant_xendit_accounts.kyc_status, Slice 1).
//
// Auth is a STATIC verification token (x-callback-token), not an HMAC over the body (the key
// difference from PayMongo): every Xendit callback carries the account's configured callback token,
// which we constant-time compare against XENDIT_CALLBACK_TOKEN (lib/xendit/signature.ts). So we do NOT
// need the raw bytes for a signature — but we still read text() once and hand the exact body to the
// shared handler, which owns the update contract + 200/4xx/5xx classification (architecture P7).
//
// Dormant until XENDIT_CALLBACK_TOKEN is set (dev/CI/current prod boot without it → 503), exactly like
// the PayMongo route's gateway-not-configured guard.
export async function POST(request: Request) {
  if (!env.XENDIT_CALLBACK_TOKEN) {
    // Rail not configured on this deployment — nothing to verify against.
    return new Response("xendit not configured", { status: 503 });
  }

  if (!verifyCallbackToken(request.headers.get("x-callback-token"), env.XENDIT_CALLBACK_TOKEN)) {
    return new Response("invalid callback token", { status: 401 });
  }

  const rawBody = await request.text();
  return handleVerifiedXenditAccountEvent(rawBody);
}
