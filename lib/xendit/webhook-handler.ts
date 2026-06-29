import { createServiceClient } from "@/lib/supabase/server";
import {
  parseAccountEvent,
  shouldApplyStatusTransition,
  type XenditAccountStatus,
} from "@/lib/xendit/status";

// Shared Xendit account-status webhook body — everything AFTER token verification (the route verifies
// x-callback-token, then hands the already-verified raw body here, so the update contract +
// idempotency live in ONE place; architecture P7, mirroring lib/paymongo/webhook-handler.ts).
//
// This handler ONLY tracks operator KYC status on tenant_xendit_accounts (Slice 1). It moves no money;
// the inbound charge confirm is a separate handler in Slice 2. It is the SINGLE writer of kyc_status —
// operators cannot write that column (RLS select-only; writes via this service-role path).
//
// Status classification: 200 for any well-formed event (applied, ignored, or idempotent no-op) so
// Xendit stops retrying; 400 only on malformed JSON; 500 only on a transient DB failure (Xendit
// retries). The pure parse + monotonic guard (lib/xendit/status.ts) keep stale/duplicate/out-of-order
// webhooks from regressing a row.
export async function handleVerifiedXenditAccountEvent(rawBody: string): Promise<Response> {
  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return new Response("malformed body", { status: 400 });
  }

  // Only account lifecycle events (OWNED account.created/updated, MANAGED registered/activated,
  // suspended) yield a status; everything else is acknowledged and ignored so Xendit stops retrying.
  const parsed = parseAccountEvent(body);
  if (!parsed) return new Response("ignored", { status: 200 });

  const admin = createServiceClient();
  const { data: row, error: selErr } = await admin
    .from("tenant_xendit_accounts")
    .select("id, kyc_status")
    .eq("sub_account_id", parsed.subAccountId)
    .maybeSingle();

  if (selErr) return new Response(`lookup failed: ${selErr.message}`, { status: 500 });
  // Not our sub-account (or the onboarding row isn't written yet) — ack so Xendit stops retrying.
  if (!row) return new Response("unknown sub-account", { status: 200 });

  // Duplicate / stale / backward event — monotonic guard rejects it; nothing to do.
  if (!shouldApplyStatusTransition(row.kyc_status as XenditAccountStatus, parsed.status)) {
    return new Response("no-op", { status: 200 });
  }

  const { error: updErr } = await admin
    .from("tenant_xendit_accounts")
    .update({ kyc_status: parsed.status, updated_at: new Date().toISOString() })
    .eq("id", row.id)
    // Optimistic guard: only write if the row is still at the status we read, so two webhooks racing
    // forward can't lost-update each other (the loser matches 0 rows = harmless no-op).
    .eq("kyc_status", row.kyc_status);

  if (updErr) return new Response(`update failed: ${updErr.message}`, { status: 500 });
  return new Response("ok", { status: 200 });
}
