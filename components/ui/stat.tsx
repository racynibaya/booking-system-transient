import type { ReactNode } from "react";

// Compact metric tile (label over value) for the dashboard.
export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-md border border-hairline p-4">
      <p className="text-caption text-muted">{label}</p>
      <p className="mt-1 text-display-sm text-ink">{value}</p>
    </div>
  );
}
