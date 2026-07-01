// Shared Xendit payout webhook body — everything AFTER token verification (the route verifies
// x-callback-token, then hands the raw body here; architecture P7). The operator-initiated withdrawal
// (createPayout) returns ACCEPTED; the final outcome arrives here as payout.succeeded / payout.failed.
//
// No payouts ledger table yet (the operator sees the result as their balance updating). A failure is
// logged loudly so it's visible until a payout-history surface is added. Always 200 for a well-formed
// event so Xendit stops retrying; 400 only on malformed JSON.
type PayoutEvent = {
  event?: string;
  data?: { id?: string; reference_id?: string; status?: string; failure_code?: string | null };
};

export async function handleVerifiedXenditPayoutEvent(rawBody: string): Promise<Response> {
  let event: PayoutEvent;
  try {
    event = JSON.parse(rawBody) as PayoutEvent;
  } catch {
    return new Response("malformed body", { status: 400 });
  }

  if (event.event === "payout.failed") {
    // Operator's withdrawal didn't land — surface it (funds stay in their sub-account; they can retry).
    console.error(
      `[xendit] payout.failed id=${event.data?.id} ref=${event.data?.reference_id} code=${event.data?.failure_code}`,
    );
  }
  return new Response("ok", { status: 200 });
}
