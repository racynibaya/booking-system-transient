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
    <div className="flex flex-col items-center gap-4 rounded-md border border-dashed border-hairline bg-linear-to-b from-surface-soft to-canvas px-6 py-12 text-center">
      {Icon && (
        <span className="flex size-12 items-center justify-center rounded-full bg-linear-to-br from-sunset-1 via-sunset-2 to-sunset-3 text-on-primary shadow-glow">
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
