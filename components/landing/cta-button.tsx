import Link from "next/link";
import type { ReactNode } from "react";

type Variant = "primary" | "secondary" | "invert";

const VARIANTS: Record<Variant, string> = {
  // dark pill — the reference's premium primary CTA (floats on the elevation scale)
  primary: "bg-ink text-canvas shadow-e2 hover:bg-black hover:shadow-e3",
  // white outline pill
  secondary: "border border-hairline bg-canvas text-ink hover:bg-surface-soft",
  // light pill for use on dark surfaces (floats off the dark panel)
  invert: "bg-canvas text-ink shadow-e2 hover:bg-surface-soft hover:shadow-e3",
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
      className={`inline-flex h-12 items-center justify-center gap-2 rounded-full px-6 text-button-md whitespace-nowrap transition-[background-color,box-shadow] duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${VARIANTS[variant]} ${className}`}
    >
      {children}
    </Link>
  );
}
