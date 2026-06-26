import { env } from "@/env";
import { createBatchTransfer, toCentavos } from "@/lib/paymongo/client";
import { createServiceClient } from "@/lib/supabase/server";

// Daily payout cron (centralized aggregator, money-OUT). Disburses each owner's accrued, CLEARED
// balance in one PayMongo batch transfer. Driven by a scheduler sending `Authorization: Bearer
// <CRON_SECRET>`. Dormant + locked: with no CRON_SECRET, no platform key, or no source account it
// refuses to run — so it can never disburse on a half-configured env.
//
// Money-correctness: claim_due_payouts() atomically reserves a tenant's due rows under one payout_id
// (a concurrent run's claim matches 0 rows, so a balance is claimed exactly once); we then submit ONE
// transfer per tenant and mark the reserved rows paid/failed. reference_number = payout_id is
// PayMongo's idempotency key. A transfer is async (created 'pending'); the failure callback flipping a
// 'paid' row back to 'failed' is a follow-up (the callback route is referenced but built in Slice 5b).

export async function GET(request: Request) {
  if (!env.CRON_SECRET) return new Response("cron not configured", { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`) {
    return new Response("unauthorized", { status: 401 });
  }

  const sk = env.PAYMONGO_PLATFORM_SECRET_KEY;
  const srcNumber = env.PAYMONGO_PAYOUT_SOURCE_NUMBER;
  const srcName = env.PAYMONGO_PAYOUT_SOURCE_NAME;
  const srcBic = env.PAYMONGO_PAYOUT_SOURCE_BIC;
  if (!sk || !srcNumber || !srcName || !srcBic) {
    return new Response("payouts not configured", { status: 503 });
  }
  const source = { number: srcNumber, name: srcName, bic: srcBic };
  const callbackUrl = env.SITE_URL ? `${env.SITE_URL}/api/webhooks/paymongo/transfers` : undefined;

  const admin = createServiceClient();
  const { data: claims, error } = await admin.rpc("claim_due_payouts");
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

  let paid = 0;
  let failed = 0;

  for (const c of claims ?? []) {
    // No institution code on the payout account → can't address the transfer. Fail it with a reason.
    if (!c.payout_bic) {
      await admin.rpc("mark_payout_failed", {
        p_payout_id: c.payout_id,
        p_reason: "payout institution (BIC) not set",
      });
      failed++;
      continue;
    }

    // GCash rides InstaPay; banks use InstaPay up to ₱50k (real-time), else PESONet (next banking day).
    const provider = c.method === "gcash" || Number(c.total) <= 50000 ? "instapay" : "pesonet";

    try {
      const transfer = await createBatchTransfer({
        secretKey: sk,
        provider,
        amountCentavos: toCentavos(Number(c.total)),
        referenceNumber: c.payout_id,
        description: `Tuloy payout ${c.payout_id}`,
        source,
        destination: { number: c.account_number, name: c.payout_name, bic: c.payout_bic },
        callbackUrl,
        metadata: { tenant_id: c.tenant_id, payout_id: c.payout_id },
      });
      await admin.rpc("mark_payout_paid", {
        p_payout_id: c.payout_id,
        p_provider_ref: transfer.transferId,
      });
      paid++;
    } catch (e) {
      const reason = e instanceof Error ? e.message.slice(0, 300) : "disbursement failed";
      await admin.rpc("mark_payout_failed", { p_payout_id: c.payout_id, p_reason: reason });
      failed++;
    }
  }

  return Response.json({ ok: true, claimed: (claims ?? []).length, paid, failed });
}
