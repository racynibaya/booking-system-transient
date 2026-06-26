"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

import { useMounted } from "@/components/motion/use-mounted";

// Fade + rise a block into view the first time it scrolls in. Drop-in replacement for a
// plain `div`: it renders one motion.div carrying the passed className, so it can stand in
// for an existing grid/flex item without changing layout. `delay` lets callers stagger
// sibling cards.
//
// Reduced-motion is honored by rendering a static, fully-visible div — but only AFTER mount.
// `useReducedMotion()` is false during SSR and resolves to the real value only on the client,
// so branching on it directly would make the server (animated) and client (static) markup
// disagree → a hydration mismatch that can leave sections stuck hidden. Gating on `mounted`
// keeps SSR + first client paint identical (both animated); reduced-motion users settle to the
// static block a frame later.
export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduce = useReducedMotion();
  const mounted = useMounted();

  if (mounted && reduce) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay }}
    >
      {children}
    </motion.div>
  );
}
