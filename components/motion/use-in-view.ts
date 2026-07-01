"use client";

import { useEffect, useRef, useState } from "react";

// Fire once when an element scrolls into view. A ~4-line IntersectionObserver replacement for
// motion's `whileInView` — no animation library in the bundle. The element animates via CSS
// (see the .reveal/.stagger rules in globals.css); this hook only flips the `is-in` class.
export function useInView<T extends HTMLElement = HTMLDivElement>(margin = "-80px 0px") {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { rootMargin: margin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [margin]);

  return { ref, inView };
}
