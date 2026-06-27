import { MapPin } from "lucide-react";

import { SAN_JUAN_AREAS } from "@/lib/areas";
import { Reveal } from "./reveal";

// Coverage proof: a seamless marquee of every San Juan barangay (the honest stand-in for a
// "trusted-by logos" strip). The track renders the list twice and shifts -50% so it loops with
// no seam; edge-fade mask dissolves chips at both ends; pauses on hover; animation is killed
// under prefers-reduced-motion (track sits static, showing the leading barangays).
export function LocalProof() {
  return (
    <section className="border-y border-hairline-soft bg-surface-soft/60 py-10">
      <Reveal className="flex flex-col items-center gap-6">
        <p className="px-6 text-center text-caption text-muted">
          Built for San Juan, La Union — all {SAN_JUAN_AREAS.length} barangays
        </p>

        <div
          className="group relative w-full overflow-hidden"
          style={{
            WebkitMaskImage:
              "linear-gradient(to right, transparent, black 6%, black 94%, transparent)",
            maskImage: "linear-gradient(to right, transparent, black 6%, black 94%, transparent)",
          }}
        >
          {/* w-max so the duplicated track lays out at full width; -50% loop is seamless. */}
          <ul className="flex w-max animate-marquee items-center gap-3 group-hover:[animation-play-state:paused]">
            {SAN_JUAN_AREAS.map((area) => (
              <Chip key={area} area={area} />
            ))}
            {/* Second copy completes the seamless loop; hidden from assistive tech. */}
            {SAN_JUAN_AREAS.map((area) => (
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
      className="flex shrink-0 items-center gap-1.5 rounded-full border border-hairline bg-canvas px-4 py-1.5 text-body-sm whitespace-nowrap text-ink shadow-e1"
    >
      <MapPin className="size-3.5 shrink-0 text-primary" />
      {area}
    </li>
  );
}
