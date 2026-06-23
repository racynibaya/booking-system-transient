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
import { CtaButton } from "./cta-button";

// Scattered orbit chips (decorative). x/y are px offsets from the hero center.
const ORBIT: { icon: LucideIcon; x: number; y: number; delay: string }[] = [
  { icon: Calendar, x: -360, y: -70, delay: "0s" },
  { icon: Users, x: -240, y: -210, delay: "1.5s" },
  { icon: MessageCircle, x: -310, y: 140, delay: "0.6s" },
  { icon: ShieldCheck, x: 130, y: -240, delay: "0.45s" },
  { icon: PhilippinePeso, x: 330, y: -120, delay: "1.2s" },
  { icon: Bell, x: 380, y: 90, delay: "0.3s" },
  { icon: Star, x: 210, y: 230, delay: "0.9s" },
];

const RINGS = [420, 620, 840];

// Floating product-event cards stacked under the CTAs (like the reference).
const CARDS: {
  icon: LucideIcon;
  title: string;
  sub: string;
  accent: string;
  delay: string;
}[] = [
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

function OrbitBackground() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 hidden md:block">
      <div className="absolute top-[44%] left-1/2">
        {RINGS.map((size) => (
          <div
            key={size}
            className="absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2 rounded-full border border-hairline-soft"
            style={{ width: size, height: size }}
          />
        ))}
        {ORBIT.map(({ icon: Icon, x, y, delay }, i) => (
          <div
            key={i}
            className="absolute top-0 left-0"
            style={{ transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))` }}
          >
            <div
              className="flex size-12 animate-float items-center justify-center rounded-full border border-hairline bg-canvas text-ink shadow-card"
              style={{ animationDelay: delay }}
            >
              <Icon className="size-5" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Hero() {
  return (
    <section className="relative overflow-hidden px-6 pt-20 pb-24">
      <OrbitBackground />
      {/* faint brand glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-1/2 -z-10 size-[480px] -translate-x-1/2 -translate-y-1/3 rounded-full bg-primary/10 blur-3xl"
      />

      <div className="relative mx-auto flex max-w-3xl flex-col items-center text-center">
        <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-hairline bg-canvas px-4 py-1.5 text-caption text-muted shadow-card">
          <MapPin className="size-3.5 text-primary" />
          Built for San Juan, La Union
        </span>

        <h1 className="font-display text-hero text-balance text-ink">
          Take bookings even while you sleep
        </h1>

        <p className="mt-6 max-w-xl text-body-md text-body">
          Tuloy turns your Facebook page into a live, bookable calendar — guests reserve and pay a
          deposit on their own, with no double-bookings and no answering &ldquo;available ba?&rdquo;
          all day.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <CtaButton href="/login">Get started free</CtaButton>
          <CtaButton href="/about#how-it-works" variant="secondary">
            See how it works
          </CtaButton>
        </div>

        <div className="mt-16 w-full max-w-sm space-y-3">
          {CARDS.map(({ icon: Icon, title, sub, accent, delay }, i) => (
            <div
              key={i}
              className="flex animate-float items-center gap-3 rounded-md border border-hairline bg-canvas p-4 text-left shadow-card"
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
      </div>
    </section>
  );
}
