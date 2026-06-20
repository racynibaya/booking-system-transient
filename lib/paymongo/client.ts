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
