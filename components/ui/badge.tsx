import type { ReactNode } from "react";

type Tone = "neutral" | "accent";

const TONES: Record<Tone, string> = {
  neutral: "bg-surface-strong text-body",
  accent: "bg-primary-disabled text-primary-active", // pale Rausch + active Rausch text
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
