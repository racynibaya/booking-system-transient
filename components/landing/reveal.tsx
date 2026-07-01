"use client";

import type { CSSProperties, ReactNode } from "react";

import { useInView } from "@/components/motion/use-in-view";

// Fade + rise a block into view the first time it scrolls in. Drop-in replacement for a plain
// `div`. CSS-driven (see `.reveal` in globals.css) so it carries no animation library — an
// IntersectionObserver just toggles the `is-in` class. `delay` staggers sibling cards.
//
// SSR + first client paint render identical markup (the `.reveal` pre-state), so there's no
// hydration mismatch. Reduced motion is honored in CSS (@media prefers-reduced-motion), which
// also means the content is never left hidden if JS is slow for those users.
export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const { ref, inView } = useInView();
  const style = delay ? ({ transitionDelay: `${delay}s` } as CSSProperties) : undefined;

  return (
    <div
      ref={ref}
      style={style}
      className={`reveal${inView ? "is-in" : ""}${className ? ` ${className}` : ""}`}
    >
      {children}
    </div>
  );
}
