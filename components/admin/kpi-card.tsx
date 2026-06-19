import type { LucideIcon } from "lucide-react";

// Compact metric card for the dashboard rail — the reference's Users/Clicks/Sales/Items tiles.
// No sparkline: there's no historical series to chart, and a fake trend line would be dishonest.
// Each card wears its own brand-derived accent so the dashboard reads colorful + playful.
export type Accent = "coral" | "blue" | "green" | "amber" | "purple" | "sunset";

const ACCENTS: Record<Accent, { card: string; chip: string }> = {
  coral: { card: "border-primary/20 bg-primary/[0.05]", chip: "bg-primary/15 text-primary" },
  blue: {
    card: "border-legal-link/25 bg-legal-link/[0.06]",
    chip: "bg-legal-link/15 text-legal-link",
  },
  green: { card: "border-success/25 bg-success/[0.06]", chip: "bg-success/15 text-success" },
  amber: { card: "border-warning/30 bg-warning/[0.07]", chip: "bg-warning/20 text-warning" },
  purple: { card: "border-luxe/25 bg-luxe/[0.06]", chip: "bg-luxe/15 text-luxe" },
  sunset: { card: "border-sunset-1/30 bg-sunset-1/[0.07]", chip: "bg-sunset-1/20 text-sunset-1" },
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
