"use client";

import { useState } from "react";
import { toast } from "sonner";

import { createSubscriptionCheckout } from "@/app/(app)/settings/subscription-actions";
import { Button } from "@/components/ui/button";
import { annualMonthsFree, chargeFor, PLANS, type BillingInterval, type PlanId } from "@/lib/plans";

// Self-serve subscription CTA. A monthly/annual toggle picks the billing period; each button then
// starts a PayMongo checkout for that tier + period and hands the operator off to the hosted payment
// page (GCash/card/Maya). The platform webhook flips the plan + advances paid_until on payment.
// "Renew" when it's the current plan, "Get" when it's an upgrade. Annual is the default (the discount
// nudge); monthly stays one tap away.
export function SubscribeButtons({
  offers,
  currentPlan,
}: {
  offers: PlanId[];
  currentPlan: PlanId;
}) {
  const [interval, setInterval] = useState<BillingInterval>("year");
  const [pending, setPending] = useState<PlanId | null>(null);

  async function pay(planId: PlanId) {
    setPending(planId);
    const res = await createSubscriptionCheckout(planId, interval);
    if (!res.ok) {
      setPending(null);
      toast.error(res.error);
      return;
    }
    // Hand off to PayMongo's hosted checkout. The webhook is the source of truth (P10).
    window.location.assign(res.checkoutUrl);
  }

  // Use the first offered tier with an annual price for the savings hint (Solo/Pro share "2 months").
  const monthsFree = offers.map(annualMonthsFree).find((m) => m > 0) ?? 0;

  return (
    <div className="flex flex-col items-stretch gap-2 sm:items-end">
      <IntervalToggle
        value={interval}
        onChange={setInterval}
        annualHint={monthsFree > 0 ? `${monthsFree} months free` : undefined}
      />
      <div className="flex flex-wrap gap-2 sm:justify-end">
        {offers.map((id) => {
          const p = PLANS[id];
          const isCurrent = id === currentPlan;
          const amount = chargeFor(id, interval) ?? p.priceMonthly ?? 0;
          const unit = interval === "year" ? "yr" : "mo";
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
                : `${isCurrent ? "Renew" : "Get"} ${p.label} · ₱${amount.toLocaleString()}/${unit}`}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

// Bespoke segmented control on the project's tokens (NOT shadcn). Annual carries the savings hint so
// the cheaper-over-the-year choice reads as the default.
function IntervalToggle({
  value,
  onChange,
  annualHint,
}: {
  value: BillingInterval;
  onChange: (v: BillingInterval) => void;
  annualHint?: string;
}) {
  const options: { id: BillingInterval; label: string }[] = [
    { id: "year", label: "Yearly" },
    { id: "month", label: "Monthly" },
  ];
  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-hairline bg-surface-soft p-1">
      {options.map((o) => {
        const active = value === o.id;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-caption-sm font-medium transition-colors ${
              active ? "bg-canvas text-ink shadow-card" : "text-muted hover:text-ink"
            }`}
          >
            {o.label}
            {o.id === "year" && annualHint && (
              <span className="rounded-full bg-primary px-1.5 py-0.5 text-[0.625rem] leading-none text-on-primary">
                {annualHint}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
