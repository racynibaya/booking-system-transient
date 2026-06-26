"use client";

import { ChevronLeft, ChevronRight, Images, X } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

export type SpacePhoto = { url: string; caption: string };

// Optimized photo (next/image `fill`) with a shimmer skeleton until it decodes. Mirrors
// rooms-section's GalleryImage; kept local so "The Space" gallery stays self-contained.
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

const MAX_MOSAIC_TILES = 6;

// Per photo-count grid template + each tile's span, so the block is always a balanced rectangle.
function mosaicLayout(count: number): { grid: string; spans: string[] } {
  if (count === 2) return { grid: "grid-cols-2 grid-rows-1", spans: ["", ""] };
  if (count === 3) {
    return { grid: "grid-cols-3 grid-rows-2", spans: ["col-span-2 row-span-2", "", ""] };
  }
  if (count === 4) return { grid: "grid-cols-2 grid-rows-2", spans: ["", "", "", ""] };
  if (count === 5) {
    return { grid: "grid-cols-4 grid-rows-2", spans: ["col-span-2 row-span-2", "", "", "", ""] };
  }
  // 6 or more — 3×2 even grid.
  return { grid: "grid-cols-3 grid-rows-2", spans: ["", "", "", "", "", ""] };
}

// Subtle bottom caption overlay shown on a tile when the photo has one.
function CaptionOverlay({ caption }: { caption: string }) {
  if (!caption) return null;
  return (
    <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-linear-to-t from-black/60 to-transparent px-3 pt-6 pb-2 text-left text-caption font-medium text-white">
      {caption}
    </span>
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

// "The Space" — captioned showcase of the property's shared areas (kitchen, common room, view).
// Mobile gets a swipeable scroll-snap carousel; desktop gets a balanced mosaic. Every photo opens
// the lightbox. Renders nothing when there are no photos.
export function SpaceGallery({ photos }: { photos: SpacePhoto[] }) {
  const [active, setActive] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (photos.length === 0) return null;

  const count = photos.length;
  const layout = mosaicLayout(count);
  const tiles = photos.slice(0, MAX_MOSAIC_TILES);
  const multi = count > 1;

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-display-sm tracking-tight text-ink">The space</h2>

      {!multi ? (
        <button
          type="button"
          onClick={() => setLightboxIndex(0)}
          className="group relative block aspect-3/2 w-full overflow-hidden rounded-md border border-hairline bg-surface-soft shadow-e2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <GalleryImage
            src={photos[0].url}
            alt={photos[0].caption || "Property photo 1"}
            sizes="(min-width: 1024px) 680px, 100vw"
            imgClassName="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.02]"
          />
          <CaptionOverlay caption={photos[0].caption} />
        </button>
      ) : (
        <div className="relative">
          {/* Mobile: swipeable carousel. Each slide snaps full-width; tapping opens the lightbox. */}
          <div className="sm:hidden">
            <div
              onScroll={(e) =>
                setActive(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))
              }
              className="flex snap-x snap-mandatory [scrollbar-width:none] overflow-x-auto overflow-y-hidden rounded-md border border-hairline shadow-e1 [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            >
              {photos.map((photo, i) => (
                <button
                  key={photo.url}
                  type="button"
                  onClick={() => setLightboxIndex(i)}
                  className="relative block aspect-3/2 w-full shrink-0 snap-center bg-surface-soft"
                >
                  <GalleryImage
                    src={photo.url}
                    alt={photo.caption || `Property photo ${i + 1}`}
                    sizes="100vw"
                    imgClassName="object-cover"
                  />
                  <CaptionOverlay caption={photo.caption} />
                </button>
              ))}
            </div>
            <div className="pointer-events-none absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/35 px-2.5 py-1.5 backdrop-blur">
              {photos.map((_, i) => (
                <span
                  key={i}
                  className={`rounded-full transition-all duration-200 ${
                    active === i ? "size-2 bg-white" : "size-1.5 bg-white/55"
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Desktop: balanced mosaic. */}
          <div
            className={`hidden aspect-3/2 gap-2 overflow-hidden rounded-md border border-hairline shadow-e2 sm:grid ${layout.grid}`}
          >
            {tiles.map((photo, i) => (
              <button
                key={photo.url}
                type="button"
                onClick={() => setLightboxIndex(i)}
                className={`group relative block overflow-hidden bg-surface-soft focus-visible:z-10 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary ${layout.spans[i]}`}
              >
                <GalleryImage
                  src={photo.url}
                  alt={photo.caption || `Property photo ${i + 1}`}
                  sizes="(min-width: 1024px) 400px, 50vw"
                  imgClassName={`object-cover transition-transform duration-500 ease-out ${
                    i === 0 ? "group-hover:scale-[1.02]" : "group-hover:scale-[1.03]"
                  }`}
                />
                <CaptionOverlay caption={photo.caption} />
              </button>
            ))}
          </div>

          {/* Desktop-only — the carousel already lets mobile guests browse every photo. */}
          <button
            type="button"
            onClick={() => setLightboxIndex(0)}
            className="absolute right-3 bottom-3 hidden items-center gap-1.5 rounded-md border border-hairline bg-canvas px-3 py-1.5 text-button-sm text-ink shadow-card transition-colors hover:bg-surface-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:bg-surface-strong sm:flex"
          >
            <Images className="size-4" /> Show all photos
          </button>
        </div>
      )}

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
