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
    title: "Cheaper than the big OTAs",
    body: "List for free and pay only when you get a booking — a fraction of the 15–25% Agoda and Booking.com take.",
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
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="text-display-lg text-balance text-ink">
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
            <Reveal
              key={title}
              delay={i * 0.08}
              className="rounded-md border border-hairline bg-canvas p-6 shadow-e1 transition-shadow duration-200 hover:shadow-e3"
            >
              <span className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Icon className="size-5" />
              </span>
              <h3 className="mt-5 text-title-md text-ink">{title}</h3>
              <p className="mt-2 text-body-sm text-body">{body}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
