import { Check } from "lucide-react";

import { CtaButton } from "./cta-button";

type Tier = {
  name: string;
  blurb: string;
  price: string;
  inherits?: string;
  features: string[];
  highlight?: boolean;
};

// Subscription tiers gated by ROOM COUNT (room_types.quantity) — not property count: a big hotel is
// one property with many rooms, so property count would wrongly put it in the cheapest tier. Rooms
// track value honestly. Subscription is the only viable model while payments stay off-platform (no
// per-booking commission); prices sit under the ~₱9k/mo an operator already pays for inquiry labour.
const TIERS: Tier[] = [
  {
    name: "Solo",
    blurb: "A small transient.",
    price: "₱990",
    features: [
      "Up to 4 rooms",
      "Live booking calendar",
      "GCash deposits with proof upload",
      "Your own shareable booking page",
    ],
  },
  {
    name: "Pro",
    blurb: "A guesthouse or small hotel.",
    price: "₱2,500",
    inherits: "Everything in Solo, plus",
    features: [
      "Up to 15 rooms · multiple properties",
      "No double-bookings, guaranteed",
      "Full booking management",
      "Verified operator badge",
    ],
    highlight: true,
  },
  {
    name: "Business",
    blurb: "A full hotel.",
    price: "₱5,900",
    inherits: "Everything in Pro, plus",
    features: [
      "Unlimited rooms",
      "Multiple payment methods",
      "Priority support",
      "Channel sync — coming soon",
    ],
  },
];

export function PricingTeaser() {
  return (
    <section id="pricing" className="px-6 py-24">
      <div className="mx-auto max-w-5xl">
        <div className="text-center">
          <h2 className="text-display-lg text-balance text-ink">Pricing that grows with you</h2>
          <p className="mx-auto mt-4 max-w-md text-body-md text-body">
            Free during the pilot. After that, a flat monthly price — no commission per booking,
            ever.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {TIERS.map((t) => (
            <div
              key={t.name}
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

              <h3 className="text-title-md text-ink">{t.name}</h3>
              <p className="mt-1 text-body-sm text-muted">{t.blurb}</p>

              <div className="mt-5 flex items-baseline gap-1">
                <span className="text-display-md text-ink">{t.price}</span>
                <span className="text-body-md text-muted">/ month</span>
              </div>
              <p className="mt-1 text-caption-sm text-muted">after the pilot · no commission</p>

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
            </div>
          ))}
        </div>

        <p className="mt-8 text-center text-caption-sm text-muted">
          Start free during the pilot — pick a plan later.
        </p>
      </div>
    </section>
  );
}
