import { MapPin } from "lucide-react";

import { SAN_JUAN_AREAS } from "@/lib/areas";
import { Reveal } from "./reveal";

// Interleave the barangays into two rows so the counter-scrolling tracks aren't identical and
// adjacent alphabetical names don't clump on the same line.
const ROW_A = SAN_JUAN_AREAS.filter((_, i) => i % 2 === 0);
const ROW_B = SAN_JUAN_AREAS.filter((_, i) => i % 2 === 1);

// Coverage proof: a dual-row, counter-scrolling marquee of every San Juan barangay (the honest
// stand-in for a "trusted-by logos" wall). Each row renders its subset twice and shifts -50% so it
// loops with no seam; the two rows run opposite directions at slightly different speeds so they
// never lock step. A drifting sea-glass wash + film grain give the band the same atmosphere as the
// hero; an edge-fade mask dissolves chips at both ends; hovering the band pauses both rows; all
// motion (rows + aurora) is killed under prefers-reduced-motion (tracks sit static, showing the
// leading barangays).
export function LocalProof() {
  return (
    <section className="surface-mesh grain relative overflow-hidden border-y border-hairline-soft py-10">
      {/* Drifting ambient glow — reuses the hero's atmosphere layer (positioned + clipped parent). */}
      <div className="hero-aurora animate-aurora-drift" aria-hidden />

      <Reveal className="relative z-10 flex flex-col items-center gap-6">
        <span className="px-6 text-center text-[11px] font-semibold tracking-[0.18em] text-primary uppercase">
          Local coverage
        </span>

        <div
          className="group relative flex w-full flex-col gap-3.5 overflow-hidden"
          style={{
            WebkitMaskImage:
              "linear-gradient(to right, transparent, black 6%, black 94%, transparent)",
            maskImage: "linear-gradient(to right, transparent, black 6%, black 94%, transparent)",
          }}
        >
          {/* Row A — scrolls left at the base 50s pace. */}
          <ul className="flex w-max animate-marquee items-center gap-3 group-hover:[animation-play-state:paused]">
            {ROW_A.map((area) => (
              <Chip key={area} area={area} />
            ))}
            {ROW_A.map((area) => (
              <Chip key={`dup-${area}`} area={area} ariaHidden />
            ))}
          </ul>

          {/* Row B — same track, reversed direction + slightly slower so the rows never sync up. */}
          <ul className="flex w-max animate-marquee items-center gap-3 [animation-direction:reverse] [animation-duration:62s] group-hover:[animation-play-state:paused]">
            {ROW_B.map((area) => (
              <Chip key={area} area={area} />
            ))}
            {ROW_B.map((area) => (
              <Chip key={`dup-${area}`} area={area} ariaHidden />
            ))}
          </ul>
        </div>
      </Reveal>
    </section>
  );
}

function Chip({ area, ariaHidden }: { area: string; ariaHidden?: boolean }) {
  return (
    <li
      aria-hidden={ariaHidden}
      className="flex shrink-0 cursor-default items-center gap-2 rounded-full border border-hairline bg-linear-to-b from-canvas to-surface-soft/70 py-1.5 pr-4 pl-1.5 text-body-sm whitespace-nowrap text-ink shadow-e1 backdrop-blur-sm transition-[transform,box-shadow] duration-200 ease-[--ease-spring] hover:-translate-y-0.5 hover:shadow-e2"
    >
      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/12 ring-1 ring-primary/15 ring-inset">
        <MapPin className="size-3 text-primary" />
      </span>
      {area}
    </li>
  );
}
