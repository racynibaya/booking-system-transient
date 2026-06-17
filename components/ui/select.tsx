import type { SelectHTMLAttributes } from "react";

// Matches the Input token treatment.
export function Select({
  className = "",
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`h-14 w-full rounded-sm border border-hairline bg-canvas px-3.5 text-body-md text-ink transition-colors focus:border-2 focus:border-ink focus:outline-none ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}
