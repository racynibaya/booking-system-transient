import type { InputHTMLAttributes } from "react";

// text-input token: white surface, 1px hairline, 8px radius, 56px tall. On focus
// the border thickens to 2px ink — no glow, no ring.
export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`h-14 w-full rounded-sm border border-hairline bg-canvas px-3.5 text-body-md text-ink transition-colors placeholder:text-muted focus:border-2 focus:border-ink focus:outline-none ${className}`}
      {...props}
    />
  );
}
