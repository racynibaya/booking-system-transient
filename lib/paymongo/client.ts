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
