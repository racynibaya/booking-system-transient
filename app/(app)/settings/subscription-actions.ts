"use server";

import { headers } from "next/headers";

import { env } from "@/env";
import { createCheckoutSession, toCentavos } from "@/lib/paymongo/client";
import { chargeFor, PLANS, type BillingInterval, type PlanId } from "@/lib/plans";
import { getCurrentTenant, requireUser } from "@/lib/supabase/dal";

// Operator subscription checkout (operator → Tuloy). The operator pays TULOY for the software on
// Tuloy's OWN PayMongo account (PAYMONGO_PLATFORM_SECRET_KEY) — a separate rail from the guest-deposit
// gateway (which uses the operator's own per-tenant keys). Confirmation is out-of-band: the platform
// webhook (app/api/webhooks/paymongo/subscription) → record_subscription_payment flips the plan +
// advances paid_until. The return redirect is best-effort UX, never the source of truth (arch P10).
export type SubscriptionCheckoutResult =
  | { ok: true; checkoutUrl: string }
  | { ok: false; error: string };

export async function createSubscriptionCheckout(
  planId: PlanId,
  interval: BillingInterval = "month",
): Promise<SubscriptionCheckoutResult> {
  await requireUser();
  const tenant = await getCurrentTenant();
  if (!tenant) return { ok: false, error: "Your operator account isn't set up yet." };

  // Only self-serve-charged tiers have a numeric price at this interval. free has nothing to pay;
  // business is value-priced/contact-sales (Messenger), so it never starts a checkout here.
  const plan = PLANS[planId];
  const amount = chargeFor(planId, interval);
  if (!plan || amount === null) {
    return { ok: false, error: "That plan isn't available for self-serve checkout." };
  }

  // Dormant when the platform account isn't configured — the UI keeps the Messenger fallback.
  const secretKey = env.PAYMONGO_PLATFORM_SECRET_KEY;
  if (!secretKey) {
    return { ok: false, error: "Online plan payments aren't enabled yet — message us to upgrade." };
  }

  // Prefer the stable SITE_URL; fall back to the request origin (operator's own dashboard origin).
  let origin = env.SITE_URL ?? "";
  if (!origin) {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
    const proto = h.get("x-forwarded-proto") ?? "https";
    origin = `${proto}://${host}`;
  }

  try {
    const { checkoutUrl } = await createCheckoutSession({
      secretKey,
      lineItems: [
        {
          name: `${plan.label} plan — ${interval === "year" ? "yearly" : "monthly"}`,
          amount: toCentavos(amount),
          quantity: 1,
        },
      ],
      description: `${plan.label} subscription (${tenant.id})`,
      successUrl: `${origin}/settings/billing/return`,
      cancelUrl: `${origin}/settings`,
      // The webhook maps the payment back to this tenant + tier + period via these.
      metadata: {
        kind: "subscription",
        tenant_id: tenant.id as string,
        plan: planId,
        interval,
      },
    });
    return { ok: true, checkoutUrl };
  } catch {
    return { ok: false, error: "Couldn't start the payment. Please try again." };
  }
}
