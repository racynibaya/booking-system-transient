import type { ReactNode } from "react";

type Tone = "neutral" | "accent" | "success" | "warning" | "danger" | "muted";

// Semantic status scale — one badge system for the whole operator dashboard. Green = good,
// amber = needs your attention, red = dead/negative, neutral/muted for inert states. The
// brand-red `accent` is kept for non-status emphasis only (never to flag a status).
const TONES: Record<Tone, string> = {
  neutral: "bg-surface-strong text-body", // settled / terminal-neutral (completed, held)
  accent: "bg-primary-disabled text-primary-active", // brand emphasis — not a status
  success: "bg-success-bg text-success", // confirmed / approved
  warning: "bg-warning-bg text-warning", // awaiting action / pending review
  danger: "bg-error/10 text-error", // cancelled / no-show / suspended
  muted: "bg-surface-soft text-muted", // expired / dim
};

// Small pill for meta (room counts, "DOT accredited", status). On tokens only.
export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: Tone }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-badge ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}
