import type { ReactNode } from "react";

type Tone = "neutral" | "accent" | "danger" | "muted";

// Stays inside the one-color brand: Rausch for attention, the inline-error red for
// dead/negative states, neutrals for everything else (no green/amber introduced).
const TONES: Record<Tone, string> = {
  neutral: "bg-surface-strong text-body",
  accent: "bg-primary-disabled text-primary-active", // pale Rausch + active Rausch text
  danger: "bg-error/10 text-error", // cancelled / expired / no-show
  muted: "bg-surface-soft text-muted", // dim / terminal-neutral
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
