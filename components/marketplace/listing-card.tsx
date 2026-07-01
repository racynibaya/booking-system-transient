"use client";

import { MapPin, ShieldCheck, Star } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { FavoriteButton } from "@/components/favorites/favorite-button";

export type ListingCardData = {
  slug: string;
  name: string;
  area: string | null;
  coverUrl: string | null;
  fromPrice: number | null;
  // Boosted (actively-paying Pro/Business) listings get a "Featured" badge — the visible face of the
  // marketplace tier boost. Optional: it's a grid-only signal, deliberately NOT persisted into a
  // saved favorite (it can change day to day).
  featured?: boolean;
};

// A single operator in the marketplace grid. The "Verified" stamp is the signature element —
// it reuses the exact pill treatment from the [slug] hero so the card and the page it links to
// read as one trust system. Coverless listings get the brand sea-gradient (mirrors the hero)
// rather than an empty box. The card fades + rises into view on scroll, staggered by column
// (`index`), so the grid feels alive as you browse — not just on first paint.
export function ListingCard({
  slug,
  name,
  area,
  coverUrl,
  fromPrice,
  featured = false,
  index = 0,
}: ListingCardData & { index?: number }) {
  // Shimmer skeleton until the cover decodes, then fades out. `complete` is checked on mount so
  // cached images (whose onLoad fires before React attaches) don't leave the shimmer stuck on.
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (imgRef.current?.complete) setLoaded(true);
  }, [coverUrl]);

  return (
    <Link
      href={`/${slug}`}
      style={{ animationDelay: `${Math.min(index, 7) * 60}ms` }}
      className="group flex animate-card-rise flex-col gap-3 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <div className="relative aspect-3/2 overflow-hidden rounded-md border border-hairline bg-surface-soft shadow-e1 transition-[box-shadow,transform] duration-300 ease-out group-hover:-translate-y-0.5 group-hover:shadow-e3">
        {coverUrl ? (
          <Image
            ref={imgRef}
            src={coverUrl}
            alt={name}
            fill
            sizes="(min-width: 1280px) 290px, (min-width: 1024px) 30vw, (min-width: 640px) 45vw, 100vw"
            onLoad={() => setLoaded(true)}
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
          />
        ) : (
          <div className="absolute inset-0 bg-linear-to-br from-sunset-1 via-sunset-2 to-sunset-3">
            <div className="absolute inset-0 bg-[radial-gradient(110%_80%_at_15%_0%,rgba(255,255,255,0.25),transparent_55%)]" />
            <Image
              src="/favicon/tuloy-icon-white.svg"
              alt=""
              width={200}
              height={200}
              className="pointer-events-none absolute -right-4 -bottom-6 size-32 opacity-[0.12]"
            />
          </div>
        )}
        {coverUrl && (
          <span
            aria-hidden
            className={`pointer-events-none absolute inset-0 animate-shimmer bg-[linear-gradient(110deg,var(--color-surface-strong)_15%,#ffffff_50%,var(--color-surface-strong)_85%)] bg-size-[200%_100%] transition-opacity duration-500 ${
              loaded ? "opacity-0" : "opacity-100"
            }`}
          />
        )}
        {/* Featured = the visible face of the tier boost (actively-paying Pro/Business). Mirrors the
            verified pill's glass treatment, set off by a gold star. */}
        {featured && (
          <span className="pointer-events-none absolute top-3 left-3 z-10 inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-white/15 px-2.5 py-1 text-caption font-medium text-white shadow-sm backdrop-blur">
            <Star className="size-3.5 shrink-0 fill-star-rating text-star-rating" /> Featured
          </span>
        )}
        {/* Heart sits above the link so a tap saves instead of navigating (handled in the button). */}
        <div className="absolute top-3 right-3 z-10">
          <FavoriteButton
            slug={slug}
            name={name}
            area={area}
            coverUrl={coverUrl}
            fromPrice={fromPrice}
          />
        </div>
        {/* Top vignette: gives photos art-directed depth and keeps the glass badges legible. */}
        {coverUrl && (
          <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-linear-to-b from-black/20 to-transparent" />
        )}
        {/* Bottom scrim so the white verified pill stays legible over any cover photo. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-linear-to-t from-black/45 to-transparent" />
        <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-white/15 px-2.5 py-1 text-caption font-medium text-white backdrop-blur">
          <ShieldCheck className="size-3.5 shrink-0 text-white" /> Verified
        </span>
      </div>

      <div className="flex flex-col gap-1">
        <h3 className="truncate text-title-md font-semibold text-ink">{name}</h3>
        {area && (
          <p className="flex items-center gap-1 text-body-sm text-muted">
            <MapPin className="size-4 shrink-0" /> {area}
          </p>
        )}
        {fromPrice != null && (
          <p className="mt-0.5 text-title-md text-ink">
            From ₱{Number(fromPrice).toLocaleString("en-PH")}
            <span className="text-body-sm font-normal text-muted"> / night</span>
          </p>
        )}
      </div>
    </Link>
  );
}
