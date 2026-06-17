import type { TextareaHTMLAttributes } from "react";

// Matches the Input token treatment (hairline border, rounded-sm, 2px-ink focus).
export function Textarea({
  className = "",
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`min-h-24 w-full rounded-sm border border-hairline bg-canvas px-3.5 py-3 text-body-md text-ink transition-colors placeholder:text-muted focus:border-2 focus:border-ink focus:outline-none ${className}`}
      {...props}
    />
  );
}
