"use client";

import {
  Children,
  cloneElement,
  isValidElement,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from "react";

import { useInView } from "./use-in-view";

// Scroll-staggered entrance for grids / lists. Wrap a grid in <Stagger> and each cell in
// <StaggerItem>; items fade + rise ~50ms apart the first time the group scrolls into view.
// CSS-driven (see `.stagger` in globals.css) — no animation library in the bundle. The
// container's IntersectionObserver toggles `is-in`; each item's delay comes from its index.
// Reduced motion is honored in CSS, so nothing is left hidden if JS is slow.
export function Stagger({ children, className }: { children: ReactNode; className?: string }) {
  const { ref, inView } = useInView("-60px 0px");

  // Give each StaggerItem its position so CSS can offset its transition-delay.
  let i = 0;
  const items = Children.map(children, (child) =>
    isValidElement(child)
      ? cloneElement(child as ReactElement<{ index?: number }>, { index: i++ })
      : child,
  );

  return (
    <div ref={ref} className={`stagger${inView ? "is-in" : ""}${className ? ` ${className}` : ""}`}>
      {items}
    </div>
  );
}

export function StaggerItem({
  children,
  className,
  index = 0,
}: {
  children: ReactNode;
  className?: string;
  index?: number;
}) {
  return (
    <div
      className={`stagger-item${className ? ` ${className}` : ""}`}
      style={{ "--stagger-i": index } as CSSProperties}
    >
      {children}
    </div>
  );
}
