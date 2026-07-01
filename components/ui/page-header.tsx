import type { ReactNode } from "react";

// Consistent page scaffold for every operator page (the dashboard uses its own louder deck). A
// light coastal band — sea-tinted mesh + film grain + a tide line on the bottom edge — so each
// page opens on the same quiet brand note the dashboard sets, without competing with it. Title in
// the display serif; action drops below on mobile. API unchanged so all call sites inherit it.
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
    <div className="grain surface-mesh relative isolate overflow-hidden rounded-xl border border-hairline px-5 py-6 md:px-7 md:py-7">
      {/* Tide line riding the bottom edge — the same motif as the dashboard deck, in sea tone. */}
      <svg
        aria-hidden
        viewBox="0 0 1440 120"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-10 w-full text-sea"
      >
        <path
          d="M0 70 C 240 40 440 96 720 72 C 980 50 1200 92 1440 64 L1440 120 L0 120 Z"
          fill="currentColor"
          opacity="0.06"
        />
        <path
          d="M0 96 C 280 74 500 110 800 92 C 1060 78 1260 106 1440 88 L1440 120 L0 120 Z"
          fill="currentColor"
          opacity="0.08"
        />
      </svg>

      <div className="relative z-10 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-display-xl text-ink">{title}</h1>
          {description && <p className="mt-1 text-body-sm text-muted">{description}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </div>
  );
}
