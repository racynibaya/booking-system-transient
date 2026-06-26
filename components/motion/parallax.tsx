"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { useRef, type ReactNode } from "react";

import { useMounted } from "./use-mounted";

// Subtle scroll parallax for hero media: the wrapped element drifts downward a few dozen
// pixels as the section scrolls past, so the photo lags the page and gains depth. Range is
// small on purpose (default 40px) to avoid disorientation. Translates via transform only.
// Reduced-motion renders a plain, static div — gated on `mounted` (see Reveal) so SSR and
// first client paint stay identical and there's no hydration mismatch.
export function Parallax({
  children,
  className,
  distance = 40,
}: {
  children: ReactNode;
  className?: string;
  distance?: number;
}) {
  const reduce = useReducedMotion();
  const mounted = useMounted();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [0, distance]);

  if (mounted && reduce) {
    return (
      <div ref={ref} className={className}>
        {children}
      </div>
    );
  }

  return (
    <motion.div ref={ref} className={className} style={{ y }}>
      {children}
    </motion.div>
  );
}
