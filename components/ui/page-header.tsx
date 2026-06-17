import type { ReactNode } from "react";

// Consistent page scaffold: title + optional description + optional right-aligned action.
// Wraps gracefully on mobile (action drops below).
export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-display-xl text-ink">{title}</h1>
        {description && <p className="mt-1 text-body-sm text-muted">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
