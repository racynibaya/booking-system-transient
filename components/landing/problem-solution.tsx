import { CalendarCheck, Moon, MessagesSquare, type LucideIcon } from "lucide-react";

import { Reveal } from "./reveal";

const FEATURES: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: Moon,
    title: "Bookings while you sleep",
    body: "Guests reserve 24/7 from one link — no missed inquiries at 2am, no bookings lost to a slow reply.",
  },
  {
    icon: CalendarCheck,
    title: "Never double-book again",
    body: "One live calendar across every room. The moment a date is taken, it's blocked everywhere — automatically.",
  },
  {
    icon: MessagesSquare,
    title: "Stop answering “available ba?”",
    body: "Your page shows real-time availability and prices, so you stop replying to the same question all day.",
  },
];

export function ProblemSolution() {
  return (
    <section id="features" className="px-6 py-24">
      <div className="mx-auto max-w-5xl">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="text-display-lg text-balance text-ink">
            Everything you lose to Facebook DMs — fixed
          </h2>
          <p className="mt-4 text-body-md text-body">
            Today your bookings live in Messenger threads, a notebook, and someone&rsquo;s memory.
            Tuloy puts them in one place that never sleeps and never double-books.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }, i) => (
            <Reveal
              key={title}
              delay={i * 0.08}
              className="rounded-md border border-hairline bg-canvas p-6 shadow-card"
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
