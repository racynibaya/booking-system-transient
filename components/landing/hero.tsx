import {
  Bell,
  Calendar,
  MapPin,
  MessageCircle,
  PhilippinePeso,
  ShieldCheck,
  Star,
  Users,
  type LucideIcon,
} from "lucide-react";

import { Stagger, StaggerItem } from "@/components/motion";
import { CtaButton } from "./cta-button";

// Operator landing hero (the page "List your property" points to). Centered "orbital" composition:
// faint concentric tide rings + floating glass chips of the operator value-prop (bookings,
// deposits, no double-booking), a drifting aurora behind, and a staggered page-load entrance —
// so the page reads as premium + alive rather than flat. All motion is CSS-only (float /
// aurora-drift) so this stays a Server Component, and every animation is killed under
// prefers-reduced-motion. Copy is operator-acquisition, not guest-facing.

// One floating chip on the tide rings. Per-chip position + float timing so the cluster drifts out
// of sync. Hidden below `sm` to keep mobile uncluttered.
function Chip({
  icon: Icon,
  className,
  delay,
  slow,
}: {
  icon: LucideIcon;
  className: string;
  delay: string;
  slow?: boolean;
}) {
  return (
    <div
      aria-hidden
      style={{ animationDelay: delay }}
      className={`absolute hidden size-12 items-center justify-center rounded-2xl border border-hairline bg-canvas/85 text-sea shadow-e2 backdrop-blur sm:flex lg:size-14 ${
        slow ? "animate-float-slow" : "animate-float"
      } ${className}`}
    >
      <Icon className="size-5 lg:size-6" strokeWidth={1.75} />
    </div>
  );
}

// Floating product-event cards stacked under the CTAs — illustrative of what an operator sees in
// the product (not a claim of live activity).
const CARDS: { icon: LucideIcon; title: string; sub: string; accent: string; delay: string }[] = [
  {
    icon: Calendar,
    title: "New booking confirmed",
    sub: "Room 2 · Oct 12–14 · 2 guests",
    accent: "bg-primary/10 text-primary",
    delay: "0s",
  },
  {
    icon: PhilippinePeso,
    title: "Deposit received",
    sub: "GCash · ₱2,500 · Maria S.",
    accent: "bg-emerald-50 text-emerald-600",
    delay: "0.8s",
  },
  {
    icon: ShieldCheck,
    title: "No double-booking",
    sub: "Calendar updated automatically",
    accent: "bg-ink/5 text-ink",
    delay: "1.6s",
  },
];

export function Hero() {
  return (
    <section className="grain relative isolate overflow-hidden">
      {/* Depth stack: static sea-glass mesh → slow drifting aurora → faint concentric tide rings. */}
      <div className="surface-mesh absolute inset-0 -z-10" />
      <div aria-hidden className="hero-aurora -z-10 animate-aurora-drift" />
      <svg
        aria-hidden
        viewBox="0 0 1000 1000"
        className="pointer-events-none absolute top-1/2 left-1/2 -z-10 h-[140%] w-[140%] max-w-none -translate-x-1/2 -translate-y-1/2 text-sea/20 sm:w-[110%]"
        fill="none"
      >
        <circle cx="500" cy="500" r="150" stroke="currentColor" strokeWidth="1" />
        <circle cx="500" cy="500" r="250" stroke="currentColor" strokeWidth="1" />
        <circle cx="500" cy="500" r="350" stroke="currentColor" strokeWidth="1" />
        <circle cx="500" cy="500" r="450" stroke="currentColor" strokeWidth="1" />
      </svg>

      {/* Floating value-prop chips on the rings. */}
      <Chip icon={Calendar} className="top-[18%] left-[11%]" delay="0s" />
      <Chip icon={Users} className="top-[11%] left-[27%] size-10 lg:size-11" delay="0.7s" slow />
      <Chip icon={MessageCircle} className="top-[44%] left-[6%]" delay="1.3s" slow />
      <Chip icon={Bell} className="bottom-[16%] left-[15%]" delay="0.4s" />
      <Chip icon={ShieldCheck} className="top-[16%] right-[13%]" delay="1.1s" slow />
      <Chip icon={PhilippinePeso} className="top-[42%] right-[6%]" delay="0.2s" />
      <Chip icon={Star} className="right-[14%] bottom-[18%]" delay="0.9s" slow />

      <div className="relative z-10 mx-auto flex max-w-3xl flex-col items-center px-6 pt-16 pb-24 text-center sm:pt-20">
        <Stagger className="flex flex-col items-center">
          <StaggerItem>
            <span className="inline-flex items-center gap-2 rounded-full border border-hairline bg-canvas/80 px-4 py-1.5 text-caption text-muted shadow-e1 backdrop-blur">
              <MapPin className="size-3.5 text-primary" />
              Built for San Juan, La Union
            </span>
          </StaggerItem>

          <StaggerItem>
            <h1 className="mt-6 font-display text-hero text-balance text-ink">
              Fill your rooms from San Juan&rsquo;s own marketplace
            </h1>
          </StaggerItem>

          <StaggerItem>
            <p className="mt-6 max-w-xl text-body-md text-pretty text-body">
              List with Tuloy and get found by tourists searching one trusted place to book San Juan
              — real-time availability, no double-bookings, and far less than the big OTAs charge.
              We&rsquo;re onboarding pilot operators now.
            </p>
          </StaggerItem>

          <StaggerItem>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <CtaButton href="/login">Get started free</CtaButton>
              <CtaButton href="/about#how-it-works" variant="secondary">
                See how it works
              </CtaButton>
            </div>
          </StaggerItem>

          <StaggerItem className="w-full">
            <div className="mx-auto mt-16 w-full max-w-sm space-y-3">
              {CARDS.map(({ icon: Icon, title, sub, accent, delay }, i) => (
                <div
                  key={i}
                  className="flex animate-float items-center gap-3 rounded-md border border-hairline bg-canvas/90 p-4 text-left shadow-e2 backdrop-blur"
                  style={{ animationDelay: delay }}
                >
                  <span
                    className={`flex size-9 shrink-0 items-center justify-center rounded-full ${accent}`}
                  >
                    <Icon className="size-4" />
                  </span>
                  <div>
                    <p className="text-body-sm font-medium text-ink">{title}</p>
                    <p className="text-caption-sm text-muted">{sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </StaggerItem>
        </Stagger>
      </div>

      {/* Dissolve the band into the section below. */}
      <div className="absolute inset-x-0 bottom-0 -z-10 h-28 bg-linear-to-b from-transparent to-canvas" />
    </section>
  );
}
