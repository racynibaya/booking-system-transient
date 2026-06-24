import type { HTMLAttributes } from "react";

// Surface card: rounded-md + hairline on the white canvas (ui-token.md). The single
// shadow tier is opt-in via `elevated` (use sparingly — hover/floating surfaces only).
// `lift` is an opt-in operator-shell interaction: a faint resting sea-glow that deepens
// and rises on hover (transform/shadow only). Both default off, so public/guest cards
// render byte-for-byte unchanged.
export function Card({
  className = "",
  elevated = false,
  lift = false,
  ...props
}: HTMLAttributes<HTMLDivElement> & { elevated?: boolean; lift?: boolean }) {
  return (
    <div
      className={`rounded-md border border-hairline bg-canvas ${elevated ? "shadow-card" : ""} ${
        lift
          ? "shadow-glow transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lift"
          : ""
      } ${className}`}
      {...props}
    />
  );
}
