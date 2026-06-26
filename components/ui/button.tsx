import type { ButtonHTMLAttributes, ReactNode } from "react";

// Hand-built on the design tokens (context/ui-token.md → app/globals.css @theme).
// primary = Rausch CTA (button-primary), secondary = ink-outline, ghost = text-only.
type Variant = "primary" | "secondary" | "ghost" | "cta";
type Size = "md" | "sm";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-primary text-on-primary hover:bg-primary-active disabled:bg-primary-disabled",
  // Marketing/hero CTA: a sea-glass gradient with real depth (e2 → e3 on hover) + a faint
  // brightness lift, so the single most important action on a page reads as the loud moment.
  // Use sparingly — not a drop-in for every primary button.
  cta: "bg-linear-to-br from-sunset-1 via-primary to-sea text-on-primary shadow-e2 hover:shadow-e3 hover:brightness-[1.04] disabled:from-primary-disabled disabled:via-primary-disabled disabled:to-primary-disabled disabled:shadow-none",
  secondary:
    "border border-ink bg-canvas text-ink hover:bg-surface-soft disabled:border-hairline disabled:text-muted-soft",
  ghost: "text-ink hover:underline disabled:text-muted-soft disabled:no-underline",
};

const SIZES: Record<Size, string> = {
  md: "h-12 px-6 text-button-md", // 48px — button-primary
  sm: "h-9 px-4 text-button-sm",
};

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-sm whitespace-nowrap transition duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink active:scale-[0.98] disabled:cursor-not-allowed disabled:active:scale-100";

// Class builder, so a Link can be styled as a button without nesting <button> in <a>.
export function buttonClassName({
  variant = "primary",
  size = "md",
  className = "",
}: { variant?: Variant; size?: Size; className?: string } = {}) {
  return `${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${className}`;
}

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}) {
  return (
    <button className={buttonClassName({ variant, size, className })} {...props}>
      {children}
    </button>
  );
}
