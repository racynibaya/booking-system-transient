"use client";

import { useState } from "react";
import { toast } from "sonner";

import { createSubscriptionCheckout } from "@/app/(app)/settings/subscription-actions";
import { Button } from "@/components/ui/button";
import { PLANS, type PlanId } from "@/lib/plans";

// Self-serve subscription CTA. Each button starts a PayMongo checkout for that tier and hands the
// operator off to the hosted payment page (GCash/card/Maya); the platform webhook flips the plan on
// payment. "Renew" when it's the current plan, "Get" when it's an upgrade.
export function SubscribeButtons({
  offers,
  currentPlan,
}: {
  offers: PlanId[];
  currentPlan: PlanId;
}) {
  const [pending, setPending] = useState<PlanId | null>(null);

  async function pay(planId: PlanId) {
    setPending(planId);
    const res = await createSubscriptionCheckout(planId);
    if (!res.ok) {
      setPending(null);
      toast.error(res.error);
      return;
    }
    // Hand off to PayMongo's hosted checkout. The webhook is the source of truth (P10).
    window.location.assign(res.checkoutUrl);
  }

  return (
    <div className="flex flex-wrap gap-2">
      {offers.map((id) => {
        const p = PLANS[id];
        const isCurrent = id === currentPlan;
        return (
          <Button
            key={id}
            size="sm"
            variant={isCurrent ? "primary" : "secondary"}
            disabled={pending !== null}
            onClick={() => pay(id)}
          >
            {pending === id
              ? "Starting…"
              : `${isCurrent ? "Renew" : "Get"} ${p.label} · ₱${p.priceMonthly?.toLocaleString()}`}
          </Button>
        );
      })}
    </div>
  );
}
