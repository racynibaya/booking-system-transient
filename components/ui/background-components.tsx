/**
 * HeroGlow — a soft, centered radial bloom layer for hero sections.
 *
 * Adapted from a generic radial-glow snippet to Tuloy's sea-glass palette: the glow
 * is driven by the brand token `--color-sunset-1` (light sea) via color-mix, so it
 * stays on-brand and follows theme changes instead of a hard-coded hue. Purely
 * decorative — a positioned (`relative`/`isolate`) parent is required, and it sits at
 * `-z-10` so it renders behind content. No client state; safe in Server Components.
 */
export function HeroGlow() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10"
      style={{
        backgroundImage:
          "radial-gradient(50% 60% at 28% 18%, color-mix(in srgb, var(--color-accent-warm) 38%, transparent) 0%, transparent 68%)",
        opacity: 0.55,
      }}
    />
  );
}

export default HeroGlow;
