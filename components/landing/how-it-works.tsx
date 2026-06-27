import { CheckCheck, LayoutDashboard, Store, type LucideIcon } from "lucide-react";

import { Reveal } from "./reveal";

const STEPS: { n: string; icon: LucideIcon; title: string; body: string }[] = [
  {
    n: "1",
    icon: LayoutDashboard,
    title: "List your rooms",
    body: "Add your rooms, photos, and prices, plus the GCash or bank number where you'll get paid.",
  },
  {
    n: "2",
    icon: Store,
    title: "Get discovered",
    body: "Your stay goes live on the San Juan marketplace — and you get a shareable page for your own Facebook traffic.",
  },
  {
    n: "3",
    icon: CheckCheck,
    title: "Guests book & you get paid",
    body: "Guests pick dates and pay on Tuloy. You confirm, host them, and keep your share.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-surface-soft/60 px-6 py-24">
      <div className="mx-auto max-w-5xl">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="text-display-lg text-balance text-ink">Live in an afternoon</h2>
          <p className="mt-4 text-body-md text-body">
            No website to build, no app for guests to download. Three steps and you&rsquo;re taking
            bookings from across San Juan.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {STEPS.map(({ n, icon: Icon, title, body }, i) => (
            <Reveal key={n} delay={i * 0.08} className="h-full">
              <div className="h-full rounded-md border border-hairline bg-canvas p-6 shadow-e1 transition-[transform,box-shadow] duration-300 ease-out hover:-translate-y-1 hover:border-border-strong hover:shadow-e3">
                {/* Step number as editorial structure (this is a true 1→3 sequence). */}
                <div className="flex items-center justify-between">
                  <span className="flex size-11 items-center justify-center rounded-full bg-ink text-canvas">
                    <Icon className="size-5" />
                  </span>
                  <span className="font-display text-display-md leading-none text-primary/30 tabular-nums">
                    0{n}
                  </span>
                </div>
                <h3 className="mt-5 text-title-md text-ink">{title}</h3>
                <p className="mt-2 text-body-sm text-body">{body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
