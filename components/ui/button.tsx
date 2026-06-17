import type { ButtonHTMLAttributes, ReactNode } from "react";

// Hand-built on the design tokens (context/ui-token.md → app/globals.css @theme).
// primary = Rausch CTA (button-primary), secondary = ink-outline, ghost = text-only.
type Variant = "primary" | "secondary" | "ghost";
type Size = "md" | "sm";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-primary text-on-primary hover:bg-primary-active disabled:bg-primary-disabled",
  secondary:
    "border border-ink bg-canvas text-ink hover:bg-surface-soft disabled:border-hairline disabled:text-muted-soft",
  ghost: "text-ink hover:underline disabled:text-muted-soft disabled:no-underline",
};

const SIZES: Record<Size, string> = {
  md: "h-12 px-6 text-button-md", // 48px — button-primary
  sm: "h-9 px-4 text-button-sm",
};

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-sm whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed";

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
