import { Check } from "lucide-react";
import { CtaButton } from "./cta-button";

const INCLUDED = [
  "Live booking calendar across all rooms",
  "No double-bookings, guaranteed",
  "GCash deposits with proof upload",
  "Your own shareable booking page",
];

export function PricingTeaser() {
  return (
    <section id="pricing" className="px-6 py-24">
      <div className="mx-auto max-w-md text-center">
        <h2 className="text-display-lg text-balance text-ink">Simple pricing</h2>
        <p className="mt-4 text-body-md text-body">
          Free during the pilot. After that, one flat price — no commission per booking, ever.
        </p>

        <div className="mt-10 rounded-xl border border-hairline bg-canvas p-8 text-left shadow-card">
          <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-caption-sm font-medium text-emerald-600">
            Free during the pilot
          </span>
          <div className="mt-5 flex items-baseline gap-1">
            <span className="text-rating-display text-ink">₱1,000</span>
            <span className="text-body-md text-muted">–1,500 / month</span>
          </div>
          <p className="mt-1 text-body-sm text-muted">after the pilot · flat rate</p>

          <ul className="mt-6 space-y-3">
            {INCLUDED.map((item) => (
              <li key={item} className="flex items-start gap-3">
                <Check className="mt-0.5 size-5 shrink-0 text-primary" />
                <span className="text-body-sm text-ink">{item}</span>
              </li>
            ))}
          </ul>

          <CtaButton href="#" className="mt-8 w-full">
            Start free
          </CtaButton>
        </div>
      </div>
    </section>
  );
}
