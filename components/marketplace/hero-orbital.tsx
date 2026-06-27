import {
  BedDouble,
  CalendarCheck,
  Coffee,
  KeyRound,
  Lock,
  MapPin,
  ShieldCheck,
  Sun,
  Umbrella,
  Waves,
  Wifi,
} from "lucide-react";
import Link from "next/link";

import { buttonClassName } from "@/components/ui/button";
import { Stagger, StaggerItem } from "@/components/motion";

// Centered "orbital" marketplace hero (adapted from the concentric-rings/floating-chips SaaS
// pattern). The reference's orbiting integration logos become coastal-stay glyphs drifting on
// faint tide rings — the page's signature element. All motion is CSS-only (float / aurora-drift)
// so this stays a Server Component, and every animation is killed under prefers-reduced-motion.
//
// Honesty: the reference's fabricated "activity feed" + "200,000+ users / partner logos" are NOT
// reproduced — Tuloy shows only true proof (verified hosts, real San Juan stay count, the actual
// secure-booking value). The search bar stays the functional CTA in the grid below; "Browse stays"
// smooth-scrolls there (#stays).

// One floating coastal chip on the tide rings. Position + float timing are per-chip so the cluster
// drifts out of sync (alive, not metronomic). Hidden below `sm` to keep mobile uncluttered.
function Chip({
  icon: Icon,
  className,
  delay,
  slow,
}: {
  icon: typeof Waves;
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

export function HeroOrbital({ listingCount }: { listingCount: number }) {
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

      {/* Floating coastal chips on the rings — the on-brand "orbiting logos". */}
      <Chip icon={Waves} className="top-[20%] left-[11%]" delay="0s" />
      <Chip icon={Sun} className="top-[12%] left-[27%] size-10 lg:size-11" delay="0.7s" slow />
      <Chip icon={Coffee} className="top-[46%] left-[6%]" delay="1.3s" slow />
      <Chip icon={Umbrella} className="bottom-[16%] left-[15%]" delay="0.4s" />
      <Chip icon={Wifi} className="top-[18%] right-[13%]" delay="1.1s" slow />
      <Chip icon={KeyRound} className="top-[44%] right-[6%]" delay="0.2s" />
      <Chip icon={BedDouble} className="right-[14%] bottom-[18%]" delay="0.9s" slow />
      <Chip icon={MapPin} className="top-[12%] right-[27%] size-10 lg:size-11" delay="1.6s" />

      <div className="relative z-10 mx-auto flex max-w-2xl flex-col items-center px-6 pt-16 pb-24 text-center sm:pt-20">
        <Stagger className="flex flex-col items-center">
          <StaggerItem>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-canvas/80 px-3 py-1.5 text-caption text-muted shadow-e1 backdrop-blur">
                <ShieldCheck className="size-3.5 text-primary" /> Every host verified
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-canvas/80 px-3 py-1.5 text-caption text-muted shadow-e1 backdrop-blur">
                <MapPin className="size-3.5 text-primary" /> {listingCount} stays in San Juan
              </span>
            </div>
          </StaggerItem>
          <StaggerItem>
            <h1 className="mt-6 font-display text-hero text-balance text-ink">
              Stay in San Juan, La Union
            </h1>
          </StaggerItem>
          <StaggerItem>
            <p className="mt-4 max-w-xl text-body-md text-pretty text-body">
              Every San Juan stay in one place — verified hosts, live availability, and a secure
              booking that beats chasing a dozen Messenger threads.
            </p>
          </StaggerItem>
          <StaggerItem>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <a href="#stays" className={buttonClassName({ variant: "cta" })}>
                Browse stays
              </a>
              <Link href="/about" className={buttonClassName({ variant: "secondary" })}>
                List your property
              </Link>
            </div>
          </StaggerItem>
          <StaggerItem>
            {/* Floating trust card — the honest analog of the reference's activity widget: the real
                three things a guest gets, not fabricated user events. */}
            <div className="mt-12 flex items-center gap-4 rounded-2xl border border-hairline bg-canvas/90 px-5 py-4 text-left shadow-e3 backdrop-blur">
              <TrustRow icon={ShieldCheck} label="ID-verified host" />
              <span className="h-8 w-px bg-hairline" />
              <TrustRow icon={CalendarCheck} label="Live availability" />
              <span className="h-8 w-px bg-hairline" />
              <TrustRow icon={Lock} label="Secure deposit" />
            </div>
          </StaggerItem>
        </Stagger>
      </div>

      {/* Dissolve the band into the grid section below. */}
      <div className="absolute inset-x-0 bottom-0 -z-10 h-28 bg-linear-to-b from-transparent to-canvas" />
    </section>
  );
}

function TrustRow({ icon: Icon, label }: { icon: typeof ShieldCheck; label: string }) {
  return (
    <span className="flex items-center gap-2 text-body-sm font-medium text-ink">
      <Icon className="size-4 shrink-0 text-primary" strokeWidth={2} />
      {label}
    </span>
  );
}
