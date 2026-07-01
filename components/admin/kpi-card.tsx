import type { LucideIcon } from "lucide-react";

// Compact metric card for the dashboard rail. Retoned to the restrained Sea Glass palette so the
// admin reads as calm as the operator + public surfaces: neutral canvas cards + a hairline border,
// with only a SUBTLE semantic icon chip (sea-green / success / attention). No loud per-card fills.
// Accent names are kept so call sites don't churn; they now map to three quiet tones.
export type Accent = "coral" | "blue" | "green" | "amber" | "purple" | "sunset";

const CARD = "border-hairline bg-canvas";
const ACCENTS: Record<Accent, { card: string; chip: string }> = {
  coral: { card: CARD, chip: "bg-primary/12 text-primary" },
  blue: { card: CARD, chip: "bg-primary/12 text-primary" },
  green: { card: CARD, chip: "bg-success/12 text-success" },
  amber: { card: CARD, chip: "bg-warning/15 text-warning" },
  purple: { card: CARD, chip: "bg-primary/12 text-primary" },
  sunset: { card: CARD, chip: "bg-primary/12 text-primary" },
};

export function KpiCard({
  label,
  value,
  caption,
  icon: Icon,
  accent = "coral",
}: {
  label: string;
  value: string | number;
  caption?: string;
  icon: LucideIcon;
  accent?: Accent;
}) {
  const a = ACCENTS[accent];
  return (
    <div className={`flex flex-col gap-2 rounded-md border p-4 ${a.card}`}>
      <span className={`flex size-9 items-center justify-center rounded-full ${a.chip}`}>
        <Icon className="size-4.5" />
      </span>
      <div className="flex flex-col">
        <span className="text-display-sm text-ink">{value}</span>
        <span className="text-caption text-muted">{label}</span>
        {caption && <span className="mt-0.5 text-caption-sm text-muted-soft">{caption}</span>}
      </div>
    </div>
  );
}
