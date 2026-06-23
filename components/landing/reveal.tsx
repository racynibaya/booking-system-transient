"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

// Fade + rise a block into view the first time it scrolls in. Drop-in replacement for a
// plain `div`: it renders one motion.div carrying the passed className, so it can stand in
// for an existing grid/flex item without changing layout. `delay` lets callers stagger
// sibling cards. Honors prefers-reduced-motion by rendering a static, fully-visible div.
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

  if (reduce) {
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
