import Link from "next/link";
import type { ReactNode } from "react";

type Variant = "primary" | "secondary" | "invert";

const VARIANTS: Record<Variant, string> = {
  // dark pill — the reference's premium primary CTA
  primary: "bg-ink text-canvas hover:bg-black",
  // white outline pill
  secondary: "border border-hairline bg-canvas text-ink hover:bg-surface-soft",
  // light pill for use on dark surfaces
  invert: "bg-canvas text-ink hover:bg-surface-soft",
};

export function CtaButton({
  href,
  variant = "primary",
  className = "",
  children,
}: {
  href: string;
  variant?: Variant;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex h-12 items-center justify-center gap-2 rounded-full px-6 text-button-md whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${VARIANTS[variant]} ${className}`}
    >
      {children}
    </Link>
  );
}
