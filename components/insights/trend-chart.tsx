import type { LucideIcon } from "lucide-react";

import { Card } from "@/components/ui/card";
import { IconChip } from "@/components/ui/icon-chip";
import type { TrendPoint } from "@/lib/supabase/dal";

import { DataTable } from "./data-table";

// Hand-rolled area+line chart (no chart dep — matches the bespoke-token ethos). Pure server
// component; reused for revenue and occupancy by swapping the value formatter + tone. The line
// rides an area fading to transparent; the latest month is called out with a filled dot and the
// headline figure above. A "Show data" table carries the same series for accessibility.
const PAD_X = 6;
const PAD_TOP = 14;
const BASE_Y = 104;
const VB_W = 320;
const INNER_H = BASE_Y - PAD_TOP;

export function TrendChart({
  icon,
  title,
  subtitle,
  points,
  format,
  tone = "sea",
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  points: TrendPoint[];
  format: (v: number) => string;
  tone?: "sea" | "success";
}) {
  const max = Math.max(1, ...points.map((p) => p.value));
  const denom = Math.max(1, points.length - 1);
  const color = tone === "success" ? "var(--color-success)" : "var(--color-primary)";
  const gradId = `trend-${title.replace(/\W+/g, "")}`;

  const xy = points.map((p, i) => ({
    x: PAD_X + (i / denom) * (VB_W - 2 * PAD_X),
    y: BASE_Y - (p.value / max) * INNER_H,
  }));
  const line = xy
    .map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`)
    .join(" ");
  const area = `${line} L${xy[xy.length - 1].x.toFixed(1)},${BASE_Y} L${xy[0].x.toFixed(1)},${BASE_Y} Z`;
  const last = points[points.length - 1];

  return (
    <Card elevation={1} className="flex flex-col gap-4 p-5">
      <div className="flex items-center gap-2.5">
        <IconChip icon={icon} tone={tone} />
        <div className="min-w-0">
          <h2 className="text-title-md text-ink">{title}</h2>
          <p className="text-caption-sm text-muted">{subtitle}</p>
        </div>
      </div>

      <p className="text-display-sm text-ink">
        {format(last.value)}
        <span className="ml-1.5 text-body-sm text-muted">this month</span>
      </p>

      <svg
        viewBox={`0 0 ${VB_W} ${BASE_Y + 4}`}
        className="w-full"
        role="img"
        aria-label={`${title}: ${points.map((p) => `${p.label} ${format(p.value)}`).join(", ")}`}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.22" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#${gradId})`} />
        <path
          d={line}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        {xy.map((c, i) => (
          <circle
            key={i}
            cx={c.x}
            cy={c.y}
            r={i === xy.length - 1 ? 3.5 : 2}
            fill={i === xy.length - 1 ? color : "var(--color-canvas)"}
            stroke={color}
            strokeWidth="1.5"
          />
        ))}
      </svg>

      <div className="flex justify-between text-caption-sm text-muted">
        {points.map((p) => (
          <span key={p.label}>{p.label}</span>
        ))}
      </div>

      <DataTable headers={["Month", title]} rows={points.map((p) => [p.label, format(p.value)])} />
    </Card>
  );
}
