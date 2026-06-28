import { CalendarCheck, PhilippinePeso, Search, type LucideIcon } from "lucide-react";

import { Reveal } from "./reveal";

const FEATURES: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: Search,
    title: "Tourists actually find you",
    body: "Your rooms show up when travelers search one trusted place to book San Juan — not buried three Facebook groups deep.",
  },
  {
    icon: PhilippinePeso,
    title: "0% commission to launch",
    body: "Founding operators list free and pay 0% commission — while Agoda and Booking.com take 15–25% of every booking.",
  },
  {
    icon: CalendarCheck,
    title: "Never double-book again",
    body: "One live calendar across every room. The moment a date is taken, it's blocked everywhere — automatically.",
  },
];

export function ProblemSolution() {
  return (
    <section id="features" className="px-6 py-24">
      <div className="mx-auto max-w-5xl">
        <Reveal className="mx-auto flex max-w-2xl flex-col items-center text-center">
          <span className="text-[11px] font-semibold tracking-[0.18em] text-primary uppercase">
            Why Tuloy
          </span>
          <h2 className="mt-4 text-display-lg text-balance text-ink">
            A real marketplace, not another Facebook group
          </h2>
          <p className="mt-4 text-body-md text-body">
            Today San Juan&rsquo;s bookings are scattered across Messenger threads and GCash
            screenshots. Tuloy puts your rooms in one searchable place tourists trust — and keeps
            your calendar honest.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }, i) => (
            <Reveal key={title} delay={i * 0.08} className="h-full">
              <div className="h-full rounded-md border border-hairline bg-canvas p-6 shadow-e1 transition-[transform,box-shadow] duration-300 ease-out hover:-translate-y-1 hover:border-border-strong hover:shadow-e3">
                <span className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Icon className="size-5" />
                </span>
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
