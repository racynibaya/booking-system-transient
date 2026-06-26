import "server-only";

// Thin PayMongo network client for the Phase 2a gateway spike (operator-as-merchant). Only the
// one call the deposit flow needs: create a hosted Checkout Session. No SDK dependency —
// PayMongo is a plain REST + Basic-auth API. Pure helpers (signature verify, toCentavos) live in
// ./signature so they stay unit-testable; re-exported here for convenience.
//
// SPIKE SCOPE: the secret key is passed in by the caller (env sandbox key for now). Phase 2b
// passes the operator's own decrypted key here unchanged — this module never reads env itself.

export { toCentavos, verifyWebhookSignature, parsePaymongoSignature } from "./signature";

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

// --- Webhook management (Phase 2b / M2) --------------------------------------------------
//
// The operator connect flow registers a webhook ON THE OPERATOR'S OWN PayMongo account so paid
// checkouts route back to us. As everywhere in this module, the caller passes the operator's
// secretKey; we never read env. The webhook's signing secret (whsk_) is returned by PayMongo ONLY
// at creation time — that's the whole reason we auto-register instead of asking operators to copy it.

const WEBHOOK_EVENTS = ["checkout_session.payment.paid"] as const;

export type PaymongoWebhook = { id: string; url: string; status: string };

// GET /v1/webhooks — lists the account's webhooks. Doubles as the key-validation call: an invalid
// secret key returns 401, which we surface to the operator as "key not accepted".
export async function listWebhooks(secretKey: string): Promise<PaymongoWebhook[]> {
  const res = await fetch(`${API_BASE}/webhooks`, {
    headers: { Authorization: basicAuth(secretKey) },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`PayMongo webhooks list ${res.status}: ${body}`);
  }
  const json = (await res.json()) as {
    data: { id: string; attributes: { url: string; status: string } }[];
  };
  return (json.data ?? []).map((w) => ({
    id: w.id,
    url: w.attributes.url,
    status: w.attributes.status,
  }));
}

export type RegisterWebhookResult = { id: string; secretKey: string };

// POST /v1/webhooks — registers our token-routed endpoint and returns the webhook id + its signing
// secret (whsk_). The returned secretKey IS the whsk_ used to verify inbound events (M3).
export async function registerWebhook(
  secretKey: string,
  url: string,
): Promise<RegisterWebhookResult> {
  const res = await fetch(`${API_BASE}/webhooks`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: basicAuth(secretKey),
    },
    body: JSON.stringify({ data: { attributes: { url, events: WEBHOOK_EVENTS } } }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`PayMongo webhook create ${res.status}: ${body}`);
  }
  const json = (await res.json()) as {
    data: { id: string; attributes: { secret_key: string } };
  };
  return { id: json.data.id, secretKey: json.data.attributes.secret_key };
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

// DELETE /v1/webhooks/{id} — remove a webhook (reconnect cleanup + disconnect). Best-effort: the
// caller decides whether a failure here blocks the operation.
export async function deleteWebhook(secretKey: string, webhookId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/webhooks/${webhookId}`, {
    method: "DELETE",
    headers: { Authorization: basicAuth(secretKey) },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`PayMongo webhook delete ${res.status}: ${body}`);
  }
}
