"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

import { CtaButton } from "./cta-button";
import { MobileMenu } from "./mobile-menu";

const NAV_LINKS = [
  { label: "Features", href: "/about#features", id: "features" },
  { label: "How it works", href: "/about#how-it-works", id: "how-it-works" },
  { label: "Pricing", href: "/about#pricing", id: "pricing" },
];

// Sticky landing nav. Client-side so it can (1) lift onto the elevation scale once you scroll off
// the top — transparent + borderless over the hero, solid + shadowed over content — and (2) light
// the active section as you scroll the one-page anchors (scroll-spy). Links carry an animated brand
// underline on hover / focus / active, and real focus-visible rings for keyboard users.
export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const sections = NAV_LINKS.map((l) => document.getElementById(l.id)).filter(
      (el): el is HTMLElement => el !== null,
    );
    if (sections.length === 0) return;
    // Active = the topmost section crossing the viewport's upper–middle band, so the highlight
    // tracks the section you're actually reading (offset for the 64px sticky header).
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-45% 0px -50% 0px", threshold: 0 },
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 border-b transition-[background-color,box-shadow,border-color] duration-300 ${
        scrolled
          ? "border-hairline bg-canvas/85 shadow-e1 backdrop-blur-md"
          : "border-transparent bg-canvas/60 backdrop-blur"
      }`}
    >
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
        <Link
          href="/"
          aria-label="Tuloy home"
          className="flex items-center rounded-xs focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
        >
          <Image
            src="/logo/tuloy-logo.svg"
            alt="Tuloy"
            width={67}
            height={36}
            priority
            className="h-9 w-auto"
          />
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((l) => {
            const isActive = active === l.id;
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={isActive ? "true" : undefined}
                className={`group relative rounded-xs text-nav-link transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary ${
                  isActive ? "text-ink" : "text-muted hover:text-ink"
                }`}
              >
                {l.label}
                <span
                  aria-hidden
                  className={`absolute -bottom-1.5 left-0 h-0.5 w-full origin-left rounded-full bg-primary transition-transform duration-200 ease-out ${
                    isActive
                      ? "scale-x-100"
                      : "scale-x-0 group-hover:scale-x-100 group-focus-visible:scale-x-100"
                  }`}
                />
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <CtaButton href="/login">Get started</CtaButton>
          <MobileMenu links={NAV_LINKS} />
        </div>
      </div>
    </header>
  );
}
