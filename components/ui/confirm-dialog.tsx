"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";

// Minimal confirmation modal on the design tokens (no dialog library). Portaled to <body>,
// scrim backdrop, Escape / backdrop-click to cancel, focus on the confirm button, body-scroll
// lock while open, and a subtle opacity+scale entrance (no transition-all).
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  pending = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  // Drives the entrance transition: mount hidden, flip to shown on the next frame.
  // Depends only on `open` so a `pending` change mid-action can't re-trigger the animation.
  const [shown, setShown] = useState(false);

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

  // Escape-to-cancel (kept separate so it can read the latest `pending`/`onCancel`).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pending) onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, pending, onCancel]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Cancel"
        disabled={pending}
        onClick={onCancel}
        className={`absolute inset-0 bg-scrim/50 backdrop-blur-sm transition-opacity duration-200 ${
          shown ? "opacity-100" : "opacity-0"
        }`}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative w-full max-w-sm rounded-md border border-hairline bg-canvas p-6 shadow-card transition duration-200 ease-out ${
          shown ? "scale-100 opacity-100" : "scale-95 opacity-0"
        }`}
      >
        <h2 className="text-title-md text-ink">{title}</h2>
        {description && (
          <p className="mt-2 text-body-sm leading-relaxed text-muted">{description}</p>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <Button type="button" variant="secondary" size="sm" disabled={pending} onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button type="button" size="sm" autoFocus disabled={pending} onClick={onConfirm}>
            {pending ? "Working…" : confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
