"use client";

import { ChevronLeft, ChevronRight, Images, Users, X } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

import { useSelectedRoom } from "@/components/public/selected-room-context";

// Optimized photo (next/image `fill`) that shows a shimmer skeleton until it decodes, then
// fades the skeleton away. The caller positions it inside a `relative overflow-hidden` box
// with a defined aspect ratio; the image and skeleton both fill that box. `complete` is
// checked on mount so cached images (whose onLoad fires before React attaches) don't leave
// the shimmer stuck on.
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

export type RoomCard = {
  id: string;
  name: string;
  capacity: number;
  base_price: number;
  description: string | null;
  photoUrls: string[];
};

// Desktop mosaic shows at most a lead + 4 supporting tiles (Airbnb-style). Extra photos stay
// reachable through the lightbox / "Show all photos" button.
const MAX_MOSAIC_TILES = 5;

// Per photo-count, the grid template + each tile's span so the block is always a balanced
// rectangle (no stranded last-row tile). The lead (index 0) leads large where there's room.
function mosaicLayout(count: number): { grid: string; spans: string[] } {
  if (count === 2) return { grid: "grid-cols-2 grid-rows-1", spans: ["", ""] };
  if (count === 3) {
    return { grid: "grid-cols-3 grid-rows-2", spans: ["col-span-2 row-span-2", "", ""] };
  }
  if (count === 4) return { grid: "grid-cols-2 grid-rows-2", spans: ["", "", "", ""] };
  // 5 or more — classic 1 big + 2×2.
  return { grid: "grid-cols-4 grid-rows-2", spans: ["col-span-2 row-span-2", "", "", "", ""] };
}

function Tile({
  url,
  name,
  index,
  span,
  zoom,
  onOpen,
}: {
  url: string;
  name: string;
  index: number;
  span: string;
  zoom: string;
  onOpen: (index: number) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(index)}
      className={`group relative block overflow-hidden bg-surface-soft focus-visible:z-10 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary ${span}`}
    >
      <GalleryImage
        src={url}
        alt={`${name} photo ${index + 1}`}
        sizes="(min-width: 1024px) 400px, 50vw"
        imgClassName={`object-cover transition-transform duration-500 ease-out ${zoom}`}
      />
    </button>
  );
}

// Room photos. Mobile gets a swipeable scroll-snap carousel; desktop gets a balanced mosaic
// (one large lead + supporting tiles). Every photo opens the lightbox.
function RoomGallery({
  photos,
  name,
  onOpen,
}: {
  photos: string[];
  name: string;
  onOpen: (index: number) => void;
}) {
  // Active slide for the mobile carousel dots; derived from the scroll position.
  const [active, setActive] = useState(0);

  if (photos.length === 0) return null;

  const count = photos.length;
  const layout = mosaicLayout(count);
  const tiles = photos.slice(0, MAX_MOSAIC_TILES);
  const multi = count > 1;

  // Single photo: one full-width image across all breakpoints — no carousel or mosaic.
  if (!multi) {
    return (
      <button
        type="button"
        onClick={() => onOpen(0)}
        className="group relative block aspect-3/2 w-full overflow-hidden rounded-md border border-hairline bg-surface-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <GalleryImage
          src={photos[0]}
          alt={`${name} photo 1`}
          sizes="(min-width: 1024px) 680px, 100vw"
          imgClassName="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.02]"
        />
      </button>
    );
  }

  return (
    <div className="relative">
      {/* Mobile: swipeable carousel. Each slide snaps full-width; tapping opens the lightbox. */}
      <div className="sm:hidden">
        <div
          onScroll={(e) =>
            setActive(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))
          }
          className="flex snap-x snap-mandatory [scrollbar-width:none] overflow-x-auto overflow-y-hidden rounded-md border border-hairline [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        >
          {photos.map((url, i) => (
            <button
              key={url}
              type="button"
              onClick={() => onOpen(i)}
              className="relative block aspect-3/2 w-full shrink-0 snap-center bg-surface-soft"
            >
              <GalleryImage
                src={url}
                alt={`${name} photo ${i + 1}`}
                sizes="100vw"
                imgClassName="object-cover"
              />
            </button>
          ))}
        </div>
        {/* Position dots. */}
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

      {/* Desktop: balanced mosaic. The outer radius clips tile corners; gaps read as seams. */}
      <div
        className={`hidden aspect-3/2 gap-2 overflow-hidden rounded-md border border-hairline sm:grid ${layout.grid}`}
      >
        {tiles.map((url, i) => (
          <Tile
            key={url}
            url={url}
            name={name}
            index={i}
            span={layout.spans[i]}
            zoom={i === 0 ? "group-hover:scale-[1.02]" : "group-hover:scale-[1.03]"}
            onOpen={onOpen}
          />
        ))}
      </div>

      {/* Desktop-only — the carousel already lets mobile guests browse every photo. */}
      <button
        type="button"
        onClick={() => onOpen(0)}
        className="absolute right-3 bottom-3 hidden items-center gap-1.5 rounded-md border border-hairline bg-canvas px-3 py-1.5 text-button-sm text-ink shadow-card transition-colors hover:bg-surface-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:bg-surface-strong sm:flex"
      >
        <Images className="size-4" /> Show all photos
      </button>
    </div>
  );
}

// Full-screen photo viewer. Esc / arrow keys navigate, the backdrop closes, body scroll is
// locked while open. Index wraps around the photo set.
function Lightbox({
  photos,
  name,
  index,
  setIndex,
  onClose,
}: {
  photos: string[];
  name: string;
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

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${name} photos`}
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

      <div className="flex flex-1 items-center justify-center gap-3 px-3 pb-6">
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
          src={photos[index]}
          alt={`${name} photo ${index + 1}`}
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
    </div>
  );
}

// Public room showcase. Mirrors the booking card: renders only the room the guest has
// selected there (photos, name, capacity, price). Rooms without photos still list details.
export function RoomsSection({ rooms }: { rooms: RoomCard[] }) {
  const { selectedRoomId } = useSelectedRoom();
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (rooms.length === 0) return null;
  const room = rooms.find((r) => r.id === selectedRoomId) ?? rooms[0];

  return (
    <section className="flex flex-col gap-4">
      <article key={room.id} className="flex animate-room-swap flex-col gap-4">
        <RoomGallery photos={room.photoUrls} name={room.name} onOpen={setLightboxIndex} />

        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h3 className="text-title-md font-semibold text-ink">{room.name}</h3>
          <p className="text-title-md text-ink">
            ₱{room.base_price}
            <span className="text-body-sm font-normal text-muted"> / night</span>
          </p>
        </div>

        <p className="flex items-center gap-1.5 text-body-sm text-muted">
          <Users className="size-4" /> Up to {room.capacity} guest
          {room.capacity > 1 ? "s" : ""}
        </p>

        {room.description && (
          <p className="max-w-2xl text-body-md leading-relaxed text-muted">{room.description}</p>
        )}
      </article>

      {lightboxIndex !== null && room.photoUrls.length > 0 && (
        <Lightbox
          photos={room.photoUrls}
          name={room.name}
          index={lightboxIndex}
          setIndex={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </section>
  );
}
