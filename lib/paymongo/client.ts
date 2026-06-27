import "server-only";

import type { RefundReason } from "./refund-reasons";

// Thin PayMongo network client for the Phase 2a gateway spike (operator-as-merchant). Only the
// one call the deposit flow needs: create a hosted Checkout Session. No SDK dependency —
// PayMongo is a plain REST + Basic-auth API. Pure helpers (signature verify, toCentavos) live in
// ./signature so they stay unit-testable; re-exported here for convenience.
//
// SPIKE SCOPE: the secret key is passed in by the caller (env sandbox key for now). Phase 2b
// passes the operator's own decrypted key here unchanged — this module never reads env itself.

export { toCentavos } from "./signature";

const API_BASE = "https://api.paymongo.com/v1";

function basicAuth(secretKey: string): string {
  // Basic auth: secret key as the username, empty password.
  return `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`;
}

export type CheckoutLineItem = {
  name: string;
  amount: number; // centavos
  quantity: number;
};

export type CreateCheckoutInput = {
  secretKey: string;
  lineItems: CheckoutLineItem[];
  description: string;
  successUrl: string;
  cancelUrl: string;
  // Echoed back on the webhook event — how we map a payment to its booking/tenant.
  metadata: Record<string, string>;
  // Limit to PH-relevant methods; omit to let PayMongo decide.
  paymentMethodTypes?: string[];
};

export type CreateCheckoutResult = { id: string; checkoutUrl: string };

// POST /v1/checkout_sessions — returns the hosted checkout URL to redirect the guest to.
export async function createCheckoutSession(
  input: CreateCheckoutInput,
): Promise<CreateCheckoutResult> {
  const res = await fetch(`${API_BASE}/checkout_sessions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: basicAuth(input.secretKey),
    },
    body: JSON.stringify({
      data: {
        attributes: {
          line_items: input.lineItems.map((li) => ({
            name: li.name,
            amount: li.amount,
            currency: "PHP",
            quantity: li.quantity,
          })),
          payment_method_types: input.paymentMethodTypes ?? [
            "gcash",
            "paymaya",
            "grab_pay",
            "card",
          ],
          // Enforce 3D Secure on card payments (vs "automatic" = card's default). Ignored by the
          // non-card e-wallet methods. PayMongo's hosted checkout runs the challenge.
          payment_method_options: { card: { request_three_d_secure: "any" } },
          description: input.description,
          success_url: input.successUrl,
          cancel_url: input.cancelUrl,
          metadata: input.metadata,
        },
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`PayMongo checkout_sessions ${res.status}: ${body}`);
  }

  const json = (await res.json()) as {
    data: { id: string; attributes: { checkout_url: string } };
  };
  return { id: json.data.id, checkoutUrl: json.data.attributes.checkout_url };
}

// --- Disbursements (centralized aggregator — money OUT) ----------------------------------
//
// Pay an operator their accrued, cleared share from the platform wallet via PayMongo's batch transfer
// API (POST /v2/batch_transfers — note v2). A single payout is one transfer in the array. Amount is in
// CENTAVOS. provider 'instapay' (GCash + most banks, real-time ≤₱50k) or 'pesonet' (banks, next-day).
// destination_account needs the recipient's number, name, and BIC (institution code). The transfer is
// created 'pending' and resolves via the callback webhook; reference_number = our payout_id is the
// idempotency key. Source is the platform's own wallet account (env config).

const PAYOUT_API_BASE = "https://api.paymongo.com/v2";

export type BatchTransferInput = {
  secretKey: string;
  provider: "instapay" | "pesonet";
  amountCentavos: number;
  referenceNumber: string; // our payout_id — idempotency key
  description: string;
  source: { number: string; name: string; bic: string };
  destination: { number: string; name: string; bic: string };
  callbackUrl?: string;
  metadata?: Record<string, string>;
};

export type BatchTransferResult = { batchId: string; transferId: string; status: string };

// POST /v2/batch_transfers — submit one disbursement. Throws on non-2xx (the caller marks the payout
// failed with the parsed reason). On success returns the batch + transfer ids (status starts 'pending').
export async function createBatchTransfer(input: BatchTransferInput): Promise<BatchTransferResult> {
  const res = await fetch(`${PAYOUT_API_BASE}/batch_transfers`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: basicAuth(input.secretKey),
    },
    body: JSON.stringify({
      transfers: [
        {
          provider: input.provider,
          amount: input.amountCentavos,
          currency: "PHP",
          purpose: "Disbursement",
          description: input.description,
          reference_number: input.referenceNumber,
          source_account: input.source,
          destination_account: input.destination,
          callback_url: input.callbackUrl,
          metadata: input.metadata,
        },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`PayMongo batch_transfers ${res.status}: ${body}`);
  }

  const json = (await res.json()) as {
    data: { id: string; transfers: { id: string; status: string }[] };
  };
  const transfer = json.data.transfers[0];
  return { batchId: json.data.id, transferId: transfer.id, status: transfer.status };
}

// GCash's single InstaPay receiving-institution code. GCash always disburses over InstaPay, so an
// operator paid via GCash never needs to pick — we resolve their BIC to this constant server-side.
// ⚠️ Confirm against the live receiving_institutions list when Money Movement is enabled.
export const GCASH_INSTAPAY_BIC = "GXCHPHM2XXX";

export type ReceivingInstitution = { name: string; bic: string; providers: string[] };

// GET /v2/transfers/receiving_institutions — the banks/e-wallets a payout can be addressed to, each
// with its institution code (BIC) and the rails (instapay/pesonet) it supports. Powers the operator's
// bank picker. ⚠️ Endpoint path + field names to confirm against the live Money Movement API.
export async function listReceivingInstitutions(
  secretKey: string,
): Promise<ReceivingInstitution[]> {
  const res = await fetch(`${PAYOUT_API_BASE}/transfers/receiving_institutions`, {
    headers: { Authorization: basicAuth(secretKey) },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`PayMongo receiving_institutions ${res.status}: ${body}`);
  }
  const json = (await res.json()) as {
    data: { attributes: { name: string; bic: string; providers?: string[] } }[];
  };
  return (json.data ?? []).map((i) => ({
    name: i.attributes.name,
    bic: i.attributes.bic,
    providers: i.attributes.providers ?? [],
  }));
}

export type TransferStatus = { status: string; failureReason: string | null };

// GET /v2/transfers/{id} — the AUTHORITATIVE status of a submitted transfer. The async callback body
// is only a wake-up trigger; the reconcile path re-fetches here (source of truth) before flipping a
// payout 'paid' → 'failed'. ⚠️ Endpoint path + field names to confirm against the live API.
export async function getTransfer(secretKey: string, transferId: string): Promise<TransferStatus> {
  const res = await fetch(`${PAYOUT_API_BASE}/transfers/${transferId}`, {
    headers: { Authorization: basicAuth(secretKey) },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`PayMongo transfer fetch ${res.status}: ${body}`);
  }
  const json = (await res.json()) as {
    data: { attributes: { status: string; failure_reason?: string | null } };
  };
  return {
    status: json.data.attributes.status,
    failureReason: json.data.attributes.failure_reason ?? null,
  };
}

// --- Refunds (centralized aggregator — money OUT, the refund path) -----------------------
//
// A refund is addressed to a PAYMENT (pay_…), not the payment_intent (pi_…) we persist on the deposit
// payment row. The intent carries its captured payments in attributes.payments[], so we resolve the
// pay_ from the stored pi_ with one GET, then POST /v1/refunds. Amount is in CENTAVOS, ≤ the payment
// (partial supported). reason is a fixed PayMongo enum. Uses the platform secret key (single wallet).

// Re-exported from the shared (non server-only) module so server callers can keep importing these
// from the client; the client-side refund UI imports them from refund-reasons directly.
export { REFUND_REASONS, type RefundReason } from "./refund-reasons";

// GET /v1/payment_intents/{id} → the id of the captured payment (pay_…) to refund. The stored
// provider_ref is the pi_; a checkout-session fallback (cs_…) isn't refundable via this path.
export async function resolvePaymentId(
  secretKey: string,
  paymentIntentId: string,
): Promise<string> {
  if (!paymentIntentId.startsWith("pi_")) {
    throw new Error(`unrefundable reference ${paymentIntentId} (expected a payment_intent pi_)`);
  }
  const res = await fetch(`${API_BASE}/payment_intents/${paymentIntentId}`, {
    headers: { Authorization: basicAuth(secretKey) },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`PayMongo payment_intent fetch ${res.status}: ${body}`);
  }
  const json = (await res.json()) as {
    data: { attributes: { payments?: { id: string }[] } };
  };
  const paymentId = json.data.attributes.payments?.[0]?.id;
  if (!paymentId) throw new Error(`no captured payment on ${paymentIntentId}`);
  return paymentId;
}

export type CreateRefundInput = {
  secretKey: string;
  paymentId: string; // pay_… from resolvePaymentId
  amountCentavos: number; // ≤ the payment amount (partial allowed)
  reason: RefundReason;
  notes?: string; // ≤ 255 chars
  metadata?: Record<string, string>;
};

export type RefundResult = { id: string; status: string };

// POST /v1/refunds — submit a refund. Throws on non-2xx (the caller aborts the reservation). A refund
// may resolve async (status 'pending'); we record it on a 2xx and rely on the same human-in-the-loop
// follow-up as disbursement (a failure-callback webhook is a deferred follow-up, like Slice 5b).
export async function createRefund(input: CreateRefundInput): Promise<RefundResult> {
  const res = await fetch(`${API_BASE}/refunds`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: basicAuth(input.secretKey),
    },
    body: JSON.stringify({
      data: {
        attributes: {
          amount: input.amountCentavos,
          payment_id: input.paymentId,
          reason: input.reason,
          notes: input.notes,
          metadata: input.metadata,
        },
      },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`PayMongo refunds ${res.status}: ${body}`);
  }
  const json = (await res.json()) as { data: { id: string; attributes: { status: string } } };
  return { id: json.data.id, status: json.data.attributes.status };
}
