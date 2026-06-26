import { env } from "@/env";
import { notifyAdminsPayoutFailed } from "@/lib/email/gcash-alert";
import { getTransfer } from "@/lib/paymongo/client";
import { parseTransferCallback, type TransferCallbackEvent } from "@/lib/paymongo/transfer-event";
import { createServiceClient } from "@/lib/supabase/server";

// PayMongo batch-transfer callback (money-OUT reconciliation, Slice 5b). The daily cron marks a payout
// 'paid' on a successful SUBMIT, but a transfer is async — PayMongo resolves it (succeeded/failed) and
// pings here. We DON'T trust the callback body's status: it's only a wake-up trigger. We re-fetch the
// authoritative status from PayMongo (source of truth, like the amount-guard in confirm_booking_gateway)
// and call reconcile_disbursement. A replayed callback for a real payout_id gains nothing — we read the
// real status and act on that; the RPC is idempotent.
//
// Classification mirrors the checkout webhook: 200 for any well-formed event (handled/ignored/no-op),
// 400 only on malformed JSON, 500 only on a transient re-fetch / DB failure (so PayMongo retries).

const FAILED_STATUSES = new Set(["failed", "cancelled", "canceled", "returned", "reversed"]);

export async function POST(request: Request) {
  // Dormant until the platform key exists — without it we can't re-fetch, so nothing to reconcile.
  if (!env.PAYMONGO_PLATFORM_SECRET_KEY) {
    return new Response("payouts not configured", { status: 503 });
  }

  let event: TransferCallbackEvent;
  try {
    event = JSON.parse(await request.text()) as TransferCallbackEvent;
  } catch {
    return new Response("malformed body", { status: 400 });
  }

  const { transferId, payoutId } = parseTransferCallback(event);
  if (!transferId || !payoutId) {
    // Can't address a reconcile without both — acknowledge so PayMongo stops retrying.
    return new Response("ignored", { status: 200 });
  }

  // Authoritative status from PayMongo — never the body. A fetch failure is transient → 500 to retry.
  let status: string;
  let failureReason: string | null;
  try {
    ({ status, failureReason } = await getTransfer(env.PAYMONGO_PLATFORM_SECRET_KEY, transferId));
  } catch (e) {
    return new Response(`transfer fetch failed: ${e instanceof Error ? e.message : "?"}`, {
      status: 500,
    });
  }

  const succeeded = status === "succeeded";
  const failed = FAILED_STATUSES.has(status);
  if (!succeeded && !failed) {
    // Still pending/processing — nothing to reconcile yet. Acknowledge; PayMongo pings again on resolve.
    return new Response("pending", { status: 200 });
  }

  const admin = createServiceClient();
  const { error } = await admin.rpc("reconcile_disbursement", {
    p_payout_id: payoutId,
    p_succeeded: succeeded,
    p_reason: succeeded ? undefined : (failureReason ?? `transfer ${status}`),
  });
  if (error) {
    // Transient DB blip — let PayMongo retry the callback.
    return new Response(`reconcile failed: ${error.message}`, { status: 500 });
  }

  // Best-effort human ping on a hard failure (the destination is auto-flagged by the RPC).
  if (failed) {
    await notifyAdminsPayoutFailed({ payoutId, reason: failureReason ?? `transfer ${status}` });
  }

  return new Response("ok", { status: 200 });
}
