import type { ReactNode } from "react";

// Label (caption muted) + control + inline error (text-error). Wraps in <label>
// so the caption is click-to-focus, matching the login form idiom.
export function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-caption text-muted">{label}</span>
      {children}
      {error && <span className="text-body-sm text-error">{error}</span>}
    </label>
  );
}
