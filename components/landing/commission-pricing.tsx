import { Check } from "lucide-react";

import { Reveal } from "./reveal";

// What an operator gets for listing — every item maps to a shipped feature. Kept honest: no
// live-payout-timing promise (the aggregator disbursement rail is built but dormant until PayMongo
// Money Movement clears), so this lists what's collected/managed, not when funds land.
const INCLUDED = [
  "Your listing on the San Juan marketplace",
  "A live booking page with real-time availability",
  "No double-booking across your rooms",
  "Secure guest deposits collected online",
  "Set your own prices and availability",
  "A photo gallery of your rooms and shared spaces",
  "A shareable booking link for your Facebook page",
  "Instant booking alerts by email",
  "Bookings and earnings in one dashboard",
  "Verified-host badge and profile",
];

// Pricing (founding-operator 0%): a launch offer — 0% commission while we onboard San Juan's first
// operators, NOT a permanent promise (deliberately no "ever"/"forever"; the 2.5% commission is the
// planned rate to switch on once there's traction). Operators still bear only the standard online
// payment-processing fee (not named here, not Tuloy revenue).
//
// Refined pricing card (premium, not the old heavy bordered + ribbon SaaS card): a single elevated
// surface with a soft sea-glass wash behind the "0%" signature, the included features de-listed in
// two columns under a hairline, and the OTA comparison as the closing kicker. No CTA here on
// purpose — the FinalCta section directly below carries the single "Get started free".
// The subscription `PricingTeaser` is kept dormant in-tree as the reversibility hedge — do not wire
// it back here.
export function CommissionPricing() {
  return (
    <section id="pricing" className="scroll-mt-20 px-6 py-24">
      <div className="mx-auto max-w-2xl">
        <Reveal className="relative isolate overflow-hidden rounded-xl border border-hairline bg-canvas px-8 pt-12 pb-10 text-center shadow-e3 sm:px-12">
          {/* Soft sea-glass glow behind the headline number — depth without a hard box edge. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 -top-24 -z-10 h-64 bg-[radial-gradient(closest-side,color-mix(in_srgb,var(--color-primary)_14%,transparent),transparent)]"
          />

          <span className="text-[11px] font-semibold tracking-[0.18em] text-primary uppercase">
            Founding-operator pricing
          </span>

          {/* Signature moment: the 0% set huge, "commission" anchored to its baseline. */}
          <div className="mt-5 flex items-end justify-center gap-3">
            <span className="font-sans text-[clamp(3.5rem,10vw+1rem,6rem)] leading-[0.85] tracking-tight text-ink">
              0<span className="align-top text-[0.5em] font-semibold">%</span>
            </span>
            <span className="pb-2 text-body-md text-muted sm:pb-3">commission</span>
          </div>

          <p className="mx-auto mt-5 max-w-md text-body-md text-pretty text-body">
            Free to list for San Juan&rsquo;s <span className="text-ink">founding operators</span> —
            no monthly fee, no setup cost. Get in while we launch.
          </p>

          <ul className="mt-10 grid gap-x-8 gap-y-3.5 border-t border-hairline pt-10 text-left sm:grid-cols-2">
            {INCLUDED.map((f) => (
              <li key={f} className="flex items-start gap-3">
                <Check className="mt-0.5 size-5 shrink-0 text-primary" strokeWidth={2.25} />
                <span className="text-body-sm text-ink">{f}</span>
              </li>
            ))}
          </ul>
        </Reveal>

        <p className="mx-auto mt-8 max-w-md text-center text-body-sm text-muted">
          Agoda and Booking.com take <span className="font-medium text-ink">15&ndash;25%</span> of
          every booking. Right now, our operators pay{" "}
          <span className="font-medium text-ink">0%</span>.
        </p>
      </div>
    </section>
  );
}
