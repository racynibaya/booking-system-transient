import type { LucideIcon } from "lucide-react";

// Tinted icon container — the operator shell's unit of color rhythm. Replaces the
// flat bg-surface-soft / bg-surface-strong icon squares so each card header carries a
// faint on-brand tint keyed to its meaning (sea = neutral/brand, success = done,
// warning = needs-attention, etc). Tints are low-opacity over the canvas, same idea as
// the admin revenue-hero chips. Two sizes; `gradient` swaps the flat tint for the sea
// gradient (used on hero-ish avatars). Pure display.
type Tone = "sea" | "primary" | "success" | "warning" | "danger" | "accent";

const TONES: Record<Tone, string> = {
  sea: "bg-sea/12 text-sea",
  primary: "bg-primary/12 text-primary",
  success: "bg-success/12 text-success",
  warning: "bg-warning/15 text-warning",
  danger: "bg-error/12 text-error",
  accent: "bg-accent/12 text-accent",
};

const SIZES = {
  sm: { box: "size-8 rounded-md", icon: "size-4" },
  md: { box: "size-9 rounded-md", icon: "size-4.5" },
  lg: { box: "size-10 rounded-md", icon: "size-5" },
} as const;

export function IconChip({
  icon: Icon,
  tone = "sea",
  size = "md",
  gradient = false,
  className = "",
}: {
  icon: LucideIcon;
  tone?: Tone;
  size?: keyof typeof SIZES;
  gradient?: boolean;
  className?: string;
}) {
  const s = SIZES[size];
  return (
    <span
      className={`flex shrink-0 items-center justify-center ${s.box} ${
        gradient
          ? "bg-linear-to-br from-sunset-1 via-sunset-2 to-sunset-3 text-on-primary"
          : TONES[tone]
      } ${className}`}
    >
      <Icon className={s.icon} />
    </span>
  );
}
