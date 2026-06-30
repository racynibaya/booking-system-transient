import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { ArrowRight, Plus } from "lucide-react";

// The dashboard's signature: a cinematic "command deck" that fuses the greeting with the money
// thesis on a living coastal gradient. The sea sky shifts with the time of day (sunrise warmth →
// midday surf-teal → dusk deep-teal), a slow aurora drifts behind it, grain keeps the big fill from
// going flat, and a layered tide line — the Tuloy motif, the surf that brings guests in — rides the
// bottom edge. Server component: pure display, all motion is CSS (reduced-motion safe).
const peso = (n: number) => `₱${n.toLocaleString("en-PH")}`;

type Tod = "morning" | "afternoon" | "evening";

// Each sky derives from the brand sea tokens; dusk mixes sea toward near-black for depth.
const SKY: Record<Tod, string> = {
  morning:
    "radial-gradient(125% 150% at 0% 0%, var(--color-sunset-1) 0%, var(--color-primary) 44%, var(--color-sea) 100%)",
  afternoon:
    "radial-gradient(120% 145% at 8% -10%, var(--color-accent) 0%, var(--color-primary) 46%, var(--color-sea) 100%)",
  evening:
    "radial-gradient(135% 155% at 100% 0%, var(--color-sea) 0%, color-mix(in srgb, var(--color-sea) 74%, #07171c) 52%, color-mix(in srgb, var(--color-sea) 48%, #051014) 100%)",
};

const GLASS_ACTION =
  "edge-highlight inline-flex h-10 items-center gap-2 rounded-sm bg-white/15 px-4 text-button-sm text-on-primary backdrop-blur-sm transition-[background-color,transform] duration-150 hover:bg-white/25 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

export function DashboardDeck({
  date,
  greeting,
  partOfDay,
  icon: DayIcon,
  collectedThisWeek,
  comingThisMonth,
  owesTotal,
  owesCount,
  addBookingHref,
  share,
}: {
  date: string;
  greeting: string;
  partOfDay: Tod;
  icon: LucideIcon;
  collectedThisWeek: number;
  comingThisMonth: number;
  owesTotal: number;
  owesCount: number;
  addBookingHref: string;
  share?: ReactNode;
}) {
  return (
    <section
      aria-label="Today at a glance"
      className="grain relative isolate overflow-hidden rounded-xl text-on-primary shadow-lift"
      style={{ background: SKY[partOfDay] }}
    >
      {/* Drifting aurora glow + a celestial body riding the right sky (warm sun by day, pale moon at
          dusk) — fills the negative space and ties the deck to the time of day. */}
      <div aria-hidden className="hero-aurora animate-aurora-drift" />
      <div
        aria-hidden
        className="pointer-events-none absolute top-6 -right-8 size-64 animate-float-slow rounded-full blur-xl md:size-80"
        style={{
          background:
            partOfDay === "evening"
              ? "radial-gradient(circle at 38% 38%, rgba(255,255,255,0.30) 0%, rgba(255,255,255,0.10) 42%, transparent 70%)"
              : partOfDay === "afternoon"
                ? "radial-gradient(circle, color-mix(in srgb, var(--color-accent-warm) 38%, transparent) 0%, rgba(255,255,255,0.10) 45%, transparent 72%)"
                : "radial-gradient(circle, color-mix(in srgb, var(--color-accent-warm) 64%, transparent) 0%, color-mix(in srgb, var(--color-accent-warm) 22%, transparent) 44%, transparent 72%)",
        }}
      />
      {/* Layered tide line — the surf riding the bottom edge. */}
      <svg
        aria-hidden
        viewBox="0 0 1440 220"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-32 w-full"
      >
        <path
          d="M0 120 C 220 60 420 180 720 130 C 980 88 1180 170 1440 110 L1440 220 L0 220 Z"
          fill="rgba(255,255,255,0.06)"
        />
        <path
          d="M0 160 C 260 110 460 200 760 160 C 1020 126 1240 196 1440 150 L1440 220 L0 220 Z"
          fill="rgba(255,255,255,0.08)"
        />
        <path
          d="M0 196 C 300 168 520 214 820 192 C 1080 174 1260 210 1440 188 L1440 220 L0 220 Z"
          fill="rgba(255,255,255,0.10)"
        />
      </svg>

      <div className="relative z-10 flex flex-col gap-8 p-6 md:p-9">
        {/* Greeting + actions */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="edge-highlight flex size-11 shrink-0 items-center justify-center rounded-md bg-white/15 backdrop-blur-sm">
              <DayIcon className="size-5.5" />
            </span>
            <div>
              <p className="text-caption text-on-primary/75">{date}</p>
              <h1 className="mt-0.5 font-display text-[clamp(1.7rem,3.5vw,2.6rem)] leading-[1.1] font-bold tracking-tight">
                {greeting}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href={addBookingHref} className={GLASS_ACTION}>
              <Plus className="size-4" /> Add booking
            </Link>
            {share}
          </div>
        </div>

        {/* Money thesis */}
        <div>
          <p className="text-caption text-on-primary/80">Collected this week</p>
          <p className="mt-1 font-display text-[clamp(3rem,8vw,5rem)] leading-none font-bold tracking-tight">
            {peso(collectedThisWeek)}
          </p>

          <div className="mt-7 grid max-w-xl grid-cols-2 gap-3">
            <div className="edge-highlight rounded-sm border border-white/10 bg-white/12 px-4 py-3 backdrop-blur-sm">
              <p className="text-caption-sm text-on-primary/80">Coming this month</p>
              <p className="mt-1 text-display-sm">{peso(comingThisMonth)}</p>
            </div>
            <div className="edge-highlight rounded-sm border border-white/10 bg-white/12 px-4 py-3 backdrop-blur-sm">
              <p className="text-caption-sm text-on-primary/80">Still owed</p>
              <p className="mt-1 text-display-sm">{peso(owesTotal)}</p>
              <p className="mt-0.5 text-caption-sm text-on-primary/70">
                {owesCount === 0
                  ? "all settled"
                  : `${owesCount} booking${owesCount > 1 ? "s" : ""}`}
              </p>
            </div>
          </div>

          <Link
            href="/earnings"
            className="mt-4 inline-flex items-center gap-1 text-button-sm text-on-primary/85 underline-offset-2 transition-colors hover:text-on-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            View earnings <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
