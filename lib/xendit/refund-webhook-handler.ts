// Shared Xendit refund webhook body — everything AFTER token verification (the route verifies
// x-callback-token, then hands the raw body here; architecture P7). A refund (createRefund) returns
// PENDING; the final outcome arrives here as refund.succeeded / refund.failed.
//
// No refund ledger table yet (the operator's sub-account balance reflects it). A failure is logged
// loudly — INSUFFICIENT_BALANCE means the operator already withdrew the funds, which the synchronous
// refund path also handles (suspend + recover, D3). Always 200 for a well-formed event; 400 on
// malformed JSON only.
type RefundEvent = {
  event?: string;
  data?: { id?: string; reference_id?: string; status?: string; failure_code?: string | null };
};

export async function handleVerifiedXenditRefundEvent(rawBody: string): Promise<Response> {
  let event: RefundEvent;
  try {
    event = JSON.parse(rawBody) as RefundEvent;
  } catch {
    return new Response("malformed body", { status: 400 });
  }

  if (event.event === "refund.failed") {
    console.error(
      `[xendit] refund.failed id=${event.data?.id} ref=${event.data?.reference_id} code=${event.data?.failure_code}`,
    );
  }
  return new Response("ok", { status: 200 });
}
