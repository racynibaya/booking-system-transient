"use client";

import { Heart, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

import { type FavoriteItem, useFavorites } from "./favorites-context";

// Right-side wishlist drawer. Borrows MobileMenu's vocabulary (portal, scrim, raf entrance,
// duration-200 ease-out, body-scroll lock, Escape + backdrop close) so it feels native to the app.
// Compact rows instead of full cards — the point is to scan/jump back to a saved stay, not browse.
export function FavoritesDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { favorites, count } = useFavorites();
  // Drives the entrance: mount off-canvas, slide in on the next frame.
  const [shown, setShown] = useState(false);
  const titleId = useId();

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
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      {/* Backdrop: tap anywhere outside the panel to close. */}
      <button
        type="button"
        aria-label="Close favourites"
        tabIndex={-1}
        onClick={onClose}
        className={`absolute inset-0 bg-scrim/40 backdrop-blur-sm transition-opacity duration-200 ${
          shown ? "opacity-100" : "opacity-0"
        }`}
      />
      <aside
        className={`absolute inset-y-0 right-0 flex w-full max-w-sm flex-col border-l border-hairline bg-canvas shadow-card transition-transform duration-200 ease-out ${
          shown ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <header className="flex items-center justify-between border-b border-hairline px-5 py-4">
          <h2 id={titleId} className="flex items-center gap-2 text-title-md font-semibold text-ink">
            <Heart className="size-5 fill-primary text-primary" />
            Favourites
            {count > 0 && <span className="text-body-sm font-normal text-muted">({count})</span>}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex size-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-soft hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <X className="size-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4">
          {favorites.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-surface-soft text-muted">
                <Heart className="size-6" />
              </span>
              <div>
                <p className="text-title-md text-ink">No favourites yet</p>
                <p className="mt-1 text-body-sm text-muted">
                  Tap the heart on any stay to save it here — your picks stay in this browser.
                </p>
              </div>
            </div>
          ) : (
            <ul className="flex flex-col gap-1">
              {favorites.map((f) => (
                <FavoriteRow key={f.slug} item={f} onNavigate={onClose} />
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>,
    document.body,
  );
}

function FavoriteRow({ item, onNavigate }: { item: FavoriteItem; onNavigate: () => void }) {
  const { toggle } = useFavorites();

  return (
    <li>
      <Link
        href={`/${item.slug}`}
        onClick={onNavigate}
        className="group flex items-center gap-3 rounded-md p-2 transition-colors hover:bg-surface-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <div className="relative size-16 shrink-0 overflow-hidden rounded-md border border-hairline bg-surface-soft">
          {item.coverUrl ? (
            <Image src={item.coverUrl} alt="" fill sizes="64px" className="object-cover" />
          ) : (
            <div className="absolute inset-0 bg-linear-to-br from-sunset-1 via-sunset-2 to-sunset-3" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-body-md font-semibold text-ink">{item.name}</p>
          {item.area && <p className="truncate text-body-sm text-muted">{item.area}</p>}
          {item.fromPrice != null && (
            <p className="mt-0.5 text-body-sm text-ink">
              From ₱{Number(item.fromPrice).toLocaleString("en-PH")}
              <span className="text-muted"> / night</span>
            </p>
          )}
        </div>

        <button
          type="button"
          aria-label={`Remove ${item.name} from favourites`}
          onClick={(e) => {
            // Sits inside the row link — remove without navigating.
            e.preventDefault();
            e.stopPropagation();
            toggle(item);
            toast("Removed from favourites");
          }}
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-strong hover:text-error focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <X className="size-4" />
        </button>
      </Link>
    </li>
  );
}
