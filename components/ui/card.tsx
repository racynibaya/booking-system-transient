import type { HTMLAttributes } from "react";

// Surface card: rounded-md + hairline on the white canvas (ui-token.md). The single
// shadow tier is opt-in via `elevated` (use sparingly — hover/floating surfaces only).
export function Card({
  className = "",
  elevated = false,
  ...props
}: HTMLAttributes<HTMLDivElement> & { elevated?: boolean }) {
  return (
    <div
      className={`rounded-md border border-hairline bg-canvas ${elevated ? "shadow-card" : ""} ${className}`}
      {...props}
    />
  );
}
