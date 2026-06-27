import { Check } from "lucide-react";

import { CtaButton } from "./cta-button";
import { Reveal } from "./reveal";

// What an operator gets for listing — kept to what's true today (no live-payout-timing promise:
// the aggregator disbursement rail is built but dormant until PayMongo Money Movement clears).
const INCLUDED = [
  "Your listing on the San Juan marketplace",
  "A live booking page with real-time availability",
  "No double-booking across your rooms",
  "Verified-host badge and profile",
];

// Commission pricing (D10): the active revenue model is a per-booking commission, not a
// subscription. Static by design — the real per-owner rates live in `tenant_payout_accounts`;
// the figures here are the public headline (2.5% early-adopter, 5% standard). The subscription
// `PricingTeaser` is kept dormant in-tree as the reversibility hedge — do not wire it back here.
export function CommissionPricing() {
  return (
    <section id="pricing" className="px-6 py-24">
      <div className="mx-auto max-w-3xl">
        <Reveal className="text-center">
          <h2 className="text-display-lg text-balance text-ink">Pay only when you get a booking</h2>
          <p className="mx-auto mt-4 max-w-md text-body-md text-body">
            No monthly fee, no setup cost. Tuloy earns a small commission on each booking — and
            nothing when you&rsquo;re empty.
          </p>
        </Reveal>

        <Reveal
          delay={0.08}
          className="relative mt-12 rounded-xl border-2 border-primary bg-canvas p-8 shadow-e3 sm:p-10"
        >
          <span className="absolute -top-3 left-8 inline-flex rounded-full bg-primary px-3 py-1 text-caption-sm font-medium text-canvas">
            Early-adopter rate
          </span>

          <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-display-xl text-ink">2.5%</span>
                <span className="text-body-md text-muted">per booking</span>
              </div>
              <p className="mt-1 text-body-sm text-muted">
                for pilot operators — <span className="text-ink">5%</span> after. Free to list.
              </p>
            </div>
            <CtaButton href="/login">Get started free</CtaButton>
          </div>

          <ul className="mt-8 grid gap-3 border-t border-hairline pt-8 sm:grid-cols-2">
            {INCLUDED.map((f) => (
              <li key={f} className="flex items-start gap-3">
                <Check className="mt-0.5 size-5 shrink-0 text-primary" />
                <span className="text-body-sm text-ink">{f}</span>
              </li>
            ))}
          </ul>
        </Reveal>

        <p className="mt-8 text-center text-caption-sm text-muted">
          For comparison, Agoda and Booking.com charge 15–25% per booking.
        </p>
      </div>
    </section>
  );
}
