"use client";

import { Check } from "lucide-react";
import { useState } from "react";

import {
  annualMonthsFree,
  chargeFor,
  DISPLAY_PLANS,
  type BillingInterval,
  type Plan,
} from "@/lib/plans";

import { CtaButton } from "./cta-button";
import { Reveal } from "./reveal";

// Public pricing grid. A monthly/annual toggle sits above the cards; MONTHLY is the default, with
// annual always one tap away (the "N months free" badge keeps the discount nudge visible). Annual
// prices show the per-month equivalent + the badge so the saving is legible. Business is
// value-priced/contact-sales — it has no annual self-serve price, so it keeps its single figure
// regardless of the toggle.
export function PricingTeaser() {
  const [interval, setInterval] = useState<BillingInterval>("month");

  // Shared savings copy (Solo & Pro both = 2 months free).
  const monthsFree = DISPLAY_PLANS.map((p) => annualMonthsFree(p.id)).find((m) => m > 0) ?? 0;

  return (
    <section id="pricing" className="px-6 py-24">
      <div className="mx-auto max-w-5xl">
        <Reveal className="text-center">
          <h2 className="text-display-lg text-balance text-ink">Pricing that grows with you</h2>
          <p className="mx-auto mt-4 max-w-md text-body-md text-body">
            Free during the pilot. After that, a flat price — no commission per booking, ever.
          </p>

          <div className="mt-8 flex justify-center">
            <IntervalToggle
              value={interval}
              onChange={setInterval}
              annualHint={monthsFree > 0 ? `${monthsFree} months free` : undefined}
            />
          </div>
        </Reveal>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {DISPLAY_PLANS.map((t, i) => (
            <Reveal
              key={t.id}
              delay={i * 0.08}
              className={`relative flex flex-col rounded-xl bg-canvas p-8 text-left ${
                t.highlight
                  ? "border-2 border-primary shadow-card md:-mt-3 md:mb-3"
                  : "border border-hairline"
              }`}
            >
              {t.highlight && (
                <span className="absolute -top-3 left-8 inline-flex rounded-full bg-primary px-3 py-1 text-caption-sm font-medium text-canvas">
                  Most popular
                </span>
              )}

              <h3 className="text-title-md text-ink">{t.label}</h3>
              <p className="mt-1 text-body-sm text-muted">{t.blurb}</p>

              <PriceBlock plan={t} interval={interval} />

              {t.inherits && (
                <p className="mt-6 text-caption-sm font-medium text-muted">{t.inherits}</p>
              )}
              <ul className={`${t.inherits ? "mt-3" : "mt-6"} space-y-3`}>
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-3">
                    <Check className="mt-0.5 size-5 shrink-0 text-primary" />
                    <span className="text-body-sm text-ink">{f}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-auto pt-8">
                <CtaButton
                  href="/login"
                  variant={t.highlight ? "primary" : "secondary"}
                  className="w-full"
                >
                  Start free
                </CtaButton>
              </div>
            </Reveal>
          ))}
        </div>

        <p className="mt-8 text-center text-caption-sm text-muted">
          Start free during the pilot — pick a plan later.
        </p>
      </div>
    </section>
  );
}

// The price line, reacting to the interval. Annual (when the plan has one) leads with the yearly
// total, then the per-month equivalent + savings; monthly shows the flat monthly figure. A plan with
// no annual price (Business — contact-sales) always shows its single display figure.
function PriceBlock({ plan, interval }: { plan: Plan; interval: BillingInterval }) {
  const annual = chargeFor(plan.id, "year");
  const showAnnual = interval === "year" && annual !== null && plan.priceMonthly !== null;

  if (showAnnual) {
    const perMonth = Math.round(annual / 12);
    const monthsFree = annualMonthsFree(plan.id);
    return (
      <>
        <div className="mt-5 flex items-baseline gap-1">
          <span className="text-display-md text-ink">₱{annual.toLocaleString()}</span>
          <span className="text-body-md text-muted">/ year</span>
        </div>
        <p className="mt-1 text-caption-sm text-muted">
          ₱{perMonth.toLocaleString()}/mo billed yearly
          {monthsFree > 0 ? ` · ${monthsFree} months free` : ""}
        </p>
      </>
    );
  }

  return (
    <>
      <div className="mt-5 flex items-baseline gap-1">
        <span className="text-display-md text-ink">{plan.price}</span>
        <span className="text-body-md text-muted">/ month</span>
      </div>
      <p className="mt-1 text-caption-sm text-muted">after the pilot · no commission</p>
    </>
  );
}

// Bespoke segmented control on the project's tokens (NOT shadcn). Monthly is the default; the yearly
// option carries the savings hint so the cheaper-over-the-year choice stays visible one tap away.
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
            className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-body-sm font-medium transition-colors ${
              active ? "bg-canvas text-ink shadow-card" : "text-muted hover:text-ink"
            }`}
          >
            {o.label}
            {o.id === "year" && annualHint && (
              <span className="rounded-full bg-primary px-2 py-0.5 text-caption-sm font-medium text-canvas">
                {annualHint}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
