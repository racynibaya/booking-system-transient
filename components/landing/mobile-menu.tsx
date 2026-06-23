"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";

import { CtaButton } from "./cta-button";

type NavLink = { label: string; href: string };

// Burger-triggered nav for narrow screens. Mirrors ConfirmDialog's vocabulary
// (portal, scrim, raf entrance, duration-200 ease-out, body-scroll lock) so the
// sheet feels native to the app. Hidden from md up where the inline nav takes over.
// Closes on Escape, backdrop click, and navigation; the burger doubles as the
// close affordance (Menu ↔ X).
export function MobileMenu({
  links,
  cta,
  secondary,
}: {
  links: NavLink[];
  cta?: NavLink;
  secondary?: NavLink;
}) {
  const [open, setOpen] = useState(false);
  // Drives the entrance: mount hidden, flip to shown on the next frame.
  const [shown, setShown] = useState(false);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => setShown(true));
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      cancelAnimationFrame(raf);
      document.body.style.overflow = prevOverflow;
      setShown(false); // reset for the next open
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="relative z-50 inline-flex size-11 items-center justify-center rounded-full text-ink transition-colors hover:bg-surface-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink active:bg-surface-strong"
      >
        {open ? <X className="size-5" /> : <Menu className="size-5" />}
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-x-0 top-16 bottom-0 z-40">
            {/* Backdrop: tap anywhere outside the panel to close. */}
            <button
              type="button"
              aria-label="Close menu"
              tabIndex={-1}
              onClick={close}
              className={`absolute inset-0 bg-scrim/40 backdrop-blur-sm transition-opacity duration-200 ${
                shown ? "opacity-100" : "opacity-0"
              }`}
            />
            <nav
              id={panelId}
              className={`absolute inset-x-0 top-0 origin-top border-b border-hairline bg-canvas px-6 pt-1 pb-6 shadow-card transition duration-200 ease-out ${
                shown ? "translate-y-0 opacity-100" : "-translate-y-3 opacity-0"
              }`}
            >
              <ul className="flex flex-col">
                {links.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      onClick={close}
                      className="flex items-center border-b border-hairline-soft py-4 text-nav-link text-ink transition-colors hover:text-primary focus-visible:text-primary focus-visible:outline-none"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>

              {(secondary || cta) && (
                <div className="mt-5 flex flex-col gap-3">
                  {secondary && (
                    <CtaButton href={secondary.href} variant="secondary" className="w-full">
                      {secondary.label}
                    </CtaButton>
                  )}
                  {cta && (
                    <CtaButton href={cta.href} className="w-full">
                      {cta.label}
                    </CtaButton>
                  )}
                </div>
              )}
            </nav>
          </div>,
          document.body,
        )}
    </div>
  );
}
