"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

export type SpacePhoto = { url: string; caption: string };

// Optimized photo (next/image `fill`) with a shimmer skeleton until it decodes. Mirrors
// rooms-section's GalleryImage; kept local so "The space" gallery stays self-contained.
function GalleryImage({
  src,
  alt,
  sizes,
  imgClassName,
}: {
  src: string;
  alt: string;
  sizes: string;
  imgClassName: string;
}) {
  const [loaded, setLoaded] = useState(false);
  const ref = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (ref.current?.complete) setLoaded(true);
  }, [src]);

  return (
    <>
      <Image
        ref={ref}
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        onLoad={() => setLoaded(true)}
        className={imgClassName}
      />
      <span
        aria-hidden
        className={`pointer-events-none absolute inset-0 animate-shimmer bg-[linear-gradient(90deg,var(--color-surface-soft)_25%,var(--color-surface-strong)_50%,var(--color-surface-soft)_75%)] bg-size-[200%_100%] transition-opacity duration-500 ${
          loaded ? "opacity-0" : "opacity-100"
        }`}
      />
    </>
  );
}

// Full-screen viewer. Esc / arrows navigate, backdrop closes, body scroll locks while open.
function Lightbox({
  photos,
  index,
  setIndex,
  onClose,
}: {
  photos: SpacePhoto[];
  index: number;
  setIndex: (next: number) => void;
  onClose: () => void;
}) {
  const count = photos.length;
  const go = useCallback(
    (step: number) => setIndex((index + step + count) % count),
    [index, count, setIndex],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "ArrowRight") go(1);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [go, onClose]);

  const ctrl =
    "flex size-11 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white active:bg-white/30";

  const photo = photos[index];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Property photos"
      onClick={onClose}
      className="fixed inset-0 z-50 flex flex-col bg-black/90"
    >
      <div className="flex items-center justify-between px-4 py-4 text-white">
        {count > 1 ? (
          <span className="text-body-sm tabular-nums">
            {index + 1} / {count}
          </span>
        ) : (
          <span />
        )}
        <button type="button" onClick={onClose} aria-label="Close" className={ctrl}>
          <X className="size-5" />
        </button>
      </div>

      <div className="flex flex-1 items-center justify-center gap-3 px-3 pb-4">
        {count > 1 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              go(-1);
            }}
            aria-label="Previous photo"
            className={`${ctrl} shrink-0`}
          >
            <ChevronLeft className="size-6" />
          </button>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.url}
          alt={photo.caption || `Property photo ${index + 1}`}
          onClick={(e) => e.stopPropagation()}
          className="max-h-[85vh] max-w-[92vw] rounded-md object-contain"
        />
        {count > 1 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              go(1);
            }}
            aria-label="Next photo"
            className={`${ctrl} shrink-0`}
          >
            <ChevronRight className="size-6" />
          </button>
        )}
      </div>

      {photo.caption && (
        <p className="px-4 pb-6 text-center text-body-sm text-white/85">{photo.caption}</p>
      )}
    </div>
  );
}

// "The space" — a clean captioned showcase of the property's shared areas (kitchen, common room,
// view). A uniform gallery-wall grid: equal aspect-4/3 tiles in tidy rows, each with its label
// set INSIDE the tile (bottom-left, over a soft gradient) so the grid stays perfectly aligned and
// the captions read as the signature detail. Always-visible labels (touch has no hover). Distinct
// by design from the rooms gallery's single selected-room booking showcase. Each tile opens the
// lightbox. Returns null when there are no photos.
export function SpaceGallery({ photos }: { photos: SpacePhoto[] }) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (photos.length === 0) return null;

  return (
    <section className="flex flex-col gap-5">
      <h2 className="text-display-sm tracking-tight text-ink">The space</h2>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3">
        {photos.map((photo, i) => (
          <button
            key={photo.url}
            type="button"
            onClick={() => setLightboxIndex(i)}
            aria-label={photo.caption ? `View ${photo.caption}` : `View photo ${i + 1}`}
            className="group relative block aspect-4/3 overflow-hidden rounded-md border border-hairline bg-surface-soft shadow-e1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <GalleryImage
              src={photo.url}
              alt={photo.caption || `Property photo ${i + 1}`}
              sizes="(min-width: 1024px) 360px, 50vw"
              imgClassName="object-cover transition-transform duration-500 ease-out motion-safe:group-hover:scale-[1.04]"
            />
            {photo.caption && (
              <>
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-t from-black/65 via-black/15 to-transparent"
                />
                <span className="pointer-events-none absolute inset-x-3 bottom-2.5 truncate text-left text-caption font-medium text-white">
                  {photo.caption}
                </span>
              </>
            )}
          </button>
        ))}
      </div>

      {lightboxIndex !== null && (
        <Lightbox
          photos={photos}
          index={lightboxIndex}
          setIndex={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </section>
  );
}
