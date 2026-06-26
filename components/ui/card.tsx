import type { HTMLAttributes } from "react";

const ELEVATION = { 1: "shadow-e1", 2: "shadow-e2", 3: "shadow-e3" } as const;

// Surface card: rounded-md + hairline on the white canvas (ui-token.md).
//   • `elevation` (1–3) — the depth scale (sea-tinted, top-edge highlight baked in). Prefer
//     this for new work: 1 = barely raised · 2 = floating card · 3 = high float.
//   • `hover` — spring lift on hover (rises + steps shadow up; transform/shadow only).
//   • `elevated` / `lift` — legacy prop names, now mapped onto the same scale (elevated = static
//     e1; lift = resting e1 that rises to e3 on hover) so operator/auth surfaces share the depth.
// All default off, so cards that pass none render unchanged.
export function Card({
  className = "",
  elevated = false,
  lift = false,
  elevation,
  hover = false,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  elevated?: boolean;
  lift?: boolean;
  elevation?: 1 | 2 | 3;
  hover?: boolean;
}) {
  const elev = elevation ? ELEVATION[elevation] : elevated ? "shadow-e1" : "";
  const hoverCls =
    hover || lift
      ? "shadow-e1 transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-e3"
      : "";
  return (
    <div
      className={`rounded-md border border-hairline bg-canvas ${elev} ${hoverCls} ${className}`}
      {...props}
    />
  );
}
