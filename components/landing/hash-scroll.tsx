"use client";

import { useEffect } from "react";

// The landing page is a static server page whose anchor nav (#features / #how-it-works / #pricing)
// relies on the browser's native scroll-to-hash on load. On this page that fires before the heavy
// above-the-fold content (Hero priority image, fonts) settles, and App Router hydration resets scroll
// to top — so deep links from Facebook et al. land at the top instead of the target section. This
// re-applies the scroll after layout settles, retrying a few times to ride out layout shift.
export function HashScroll() {
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (!id) return;

    let tries = 0;
    const tick = () => {
      const el = document.getElementById(id);
      // `behavior: "instant"` overrides the global `scroll-behavior: smooth` — a smooth
      // animation here fights the browser's own on-load hash scroll and loses to layout shift.
      if (el) el.scrollIntoView({ behavior: "instant", block: "start" });
      if (++tries < 8) requestAnimationFrame(() => setTimeout(tick, 120));
    };

    window.addEventListener("load", tick, { once: true });
    const t = setTimeout(tick, 300);
    return () => clearTimeout(t);
  }, []);

  return null;
}
