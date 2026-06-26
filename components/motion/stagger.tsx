"use client";

import { motion, useReducedMotion, type Variants } from "motion/react";
import type { ReactNode } from "react";

import { useMounted } from "./use-mounted";

// Scroll-staggered entrance for grids / lists. Wrap a grid in <Stagger> and each cell in
// <StaggerItem>; items fade + rise in sequence (~50ms apart) the first time the group
// scrolls into view. Built on motion variants so the container drives the children's timing.
//
// Reduced-motion renders static, fully-visible divs — gated on `mounted` (see Reveal) so SSR
// and first client paint stay identical and there's no hydration mismatch.

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05, delayChildren: 0.04 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
};

export function Stagger({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  const mounted = useMounted();

  if (mounted && reduce) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      variants={container}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-60px" }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  const mounted = useMounted();

  if (mounted && reduce) return <div className={className}>{children}</div>;

  return (
    <motion.div className={className} variants={item}>
      {children}
    </motion.div>
  );
}
