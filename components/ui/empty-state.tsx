import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

// Forgiving empty state: a soft dashed surface that teaches the next step.
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-md border border-dashed border-hairline bg-surface-soft px-6 py-12 text-center">
      {Icon && (
        <span className="flex size-12 items-center justify-center rounded-full bg-surface-strong text-muted">
          <Icon className="size-6" />
        </span>
      )}
      <div className="max-w-sm">
        <p className="text-title-md text-ink">{title}</p>
        {description && <p className="mt-1 text-body-sm text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}
