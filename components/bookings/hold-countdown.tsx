"use client";

import { useEffect, useState } from "react";

// The live, ticking hold clock for a held booking. The hold expiry is the whole reason a
// held row surfaces in Needs action, so it renders as the loudest thing on the row: gold
// while there's time, red once it's imminent. The remaining time is derived from Date.now(),
// so it's computed only AFTER mount — first paint (and SSR) show a stable, value-free
// placeholder, which keeps server and client markup identical (no hydration drift).
const RED_THRESHOLD_MS = 5 * 60 * 1000;

function mmss(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export function HoldCountdown({ expiresAt }: { expiresAt: string }) {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    const end = Date.parse(expiresAt);
    const tick = () => setRemaining(end - Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  const hot = remaining !== null && remaining <= RED_THRESHOLD_MS;
  const label =
    remaining === null
      ? "Hold expires soon"
      : remaining <= 0
        ? "Hold expiring…"
        : `Hold expires in ${mmss(remaining)}`;

  return (
    <span
      className={`inline-flex w-fit items-center gap-2 rounded-full px-3 py-1 text-body-sm font-semibold ${
        hot ? "bg-error/10 text-error" : "bg-warning-bg text-warning"
      }`}
    >
      <span
        className={`size-2 rounded-full ${hot ? "animate-pulse bg-error" : "bg-warning"}`}
        aria-hidden
      />
      {label}
    </span>
  );
}
