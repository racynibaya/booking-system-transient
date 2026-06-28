"use client";

import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useMemo, useRef, useState } from "react";

import { ListingCard, type ListingCardData } from "./listing-card";

const PAGE_SIZE = 12;
// A featured rail only reads as a curated row with ≥2 cards; a lone boost card just looks stray, so
// below this threshold the featured listings fall back into their area sections instead.
const MIN_RAIL = 2;
// Browse sections show a preview (two desktop rows). Past this, a "See all" jumps into the filtered
// area view rather than rendering a 40-card wall that buries every section below it.
const SECTION_CAP = 8;

// Client-side filtering over the full loaded set. Right for this density (a handful of San Juan
// operators in prod); if the catalog ever reaches hundreds, move filtering + sectioning server-side.
//
// Two browse modes:
//   • Browsing (no query, no area filter) → a curated "Featured stays" rail (the visible face of the
//     tier boost) followed by the grid grouped under real area headers — editorial rhythm over a
//     flat directory wall.
//   • Filtering (search or area chip active) → one flat, paginated grid of matches; sections would
//     fight an active query.
export function MarketplaceBrowser({ listings }: { listings: ListingCardData[] }) {
  const [query, setQuery] = useState("");
  const [area, setArea] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const topRef = useRef<HTMLDivElement>(null);

  const areas = useMemo(
    () => Array.from(new Set(listings.map((l) => l.area).filter(Boolean) as string[])).sort(),
    [listings],
  );

  const isFiltering = query.trim() !== "" || area !== null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return listings.filter((l) => {
      const matchesArea = !area || l.area === area;
      const matchesQuery =
        !q || l.name.toLowerCase().includes(q) || (l.area?.toLowerCase().includes(q) ?? false);
      return matchesArea && matchesQuery;
    });
  }, [listings, query, area]);

  // Curated browse view (no filter): pull featured into a rail, then group the rest by area. Section
  // order and within-section order both follow the incoming `listings` order, which the page shuffles
  // once per day — so no area or stay is permanently on top (fair exposure). The "More stays" bucket
  // (null area) is the one exception, always kept last. NO size/alpha sort here: that would re-pin a
  // fixed winner and defeat the daily rotation.
  const featured = useMemo(() => listings.filter((l) => l.featured), [listings]);
  const showRail = featured.length >= MIN_RAIL;
  const featuredSlugs = useMemo(
    () => new Set(showRail ? featured.map((l) => l.slug) : []),
    [featured, showRail],
  );
  const sections = useMemo(() => {
    const map = new Map<string, ListingCardData[]>();
    for (const l of listings) {
      if (featuredSlugs.has(l.slug)) continue; // already shown in the rail
      const key = l.area ?? "More stays"; // first-seen area sets section order (already shuffled)
      const bucket = map.get(key);
      if (bucket) bucket.push(l);
      else map.set(key, [l]);
    }
    const entries = Array.from(map.entries());
    const more = entries.filter(([title]) => title === "More stays");
    const areas = entries.filter(([title]) => title !== "More stays");
    return [...areas, ...more].map(([title, items]) => ({ title, items }));
  }, [listings, featuredSlugs]);

  // Changing a filter resets to the first page (reset in the handlers, not an effect).
  const onSearch = (value: string) => {
    setQuery(value);
    setPage(1);
  };
  const onSelectArea = (next: string | null) => {
    setArea(next);
    setPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const pageItems = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const goToPage = (p: number) => {
    setPage(Math.min(Math.max(1, p), totalPages));
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div ref={topRef} className="scroll-mt-24">
      {/* Search-first signature: the field floats up to straddle the hero band's lower edge, sitting
          on its own elevation so it reads as the page's primary action, not a toolbar. */}
      <div className="relative z-10 -mt-12 flex flex-col items-center sm:-mt-14">
        <div className="relative w-full max-w-xl">
          <Search className="pointer-events-none absolute top-1/2 left-5 size-5 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={query}
            onChange={(e) => onSearch(e.target.value)}
            aria-label="Search stays by name or area"
            placeholder="Search by name or area"
            className="h-15 w-full rounded-full border border-hairline bg-canvas pr-5 pl-13 text-body-md text-ink shadow-e3 transition-[box-shadow,border-color] placeholder:text-muted-soft hover:shadow-e4 focus-visible:border-primary focus-visible:shadow-e4 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
          />
        </div>

        {areas.length > 1 && (
          <div className="mt-5 flex max-w-full [scrollbar-width:none] gap-2 overflow-x-auto px-1 pb-1 [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            <AreaChip label="All areas" active={area === null} onClick={() => onSelectArea(null)} />
            {areas.map((a) => (
              <AreaChip key={a} label={a} active={area === a} onClick={() => onSelectArea(a)} />
            ))}
          </div>
        )}
      </div>

      {isFiltering ? (
        <div className="mt-10">
          <p className="mb-6 text-caption text-muted">
            {filtered.length} {filtered.length === 1 ? "stay" : "stays"}
            {area ? ` in ${area}` : ""}
            {query.trim() ? ` matching “${query.trim()}”` : ""}
          </p>

          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-hairline bg-surface-soft/50 px-6 py-16 text-center">
              <p className="text-body-md text-muted">No stays match your search.</p>
            </div>
          ) : (
            <>
              <CardGrid items={pageItems} />
              {totalPages > 1 && (
                <Pagination current={current} total={totalPages} onChange={goToPage} />
              )}
            </>
          )}
        </div>
      ) : (
        <div className="mt-12 flex flex-col gap-14">
          {showRail && <FeaturedRail items={featured} />}
          {sections.map((s) => (
            <AreaSection
              key={s.title}
              title={s.title}
              items={s.items}
              onSeeAll={s.title === "More stays" ? undefined : () => onSelectArea(s.title)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// A horizontal, snap-scrolling row of the actively-boosted listings — the marketplace's curated
// "lead" shelf. Edge-fades hint there's more to scroll without a scrollbar getting in the way.
function FeaturedRail({ items }: { items: ListingCardData[] }) {
  return (
    <section aria-labelledby="featured-heading">
      <SectionHeading id="featured-heading" eyebrow="Handpicked" title="Featured stays" />
      <div className="relative">
        <div className="flex snap-x snap-mandatory [scrollbar-width:none] gap-5 overflow-x-auto pt-1 pb-2 [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {items.map((c, i) => (
            <div key={c.slug} className="w-[78vw] shrink-0 snap-start sm:w-72 lg:w-80">
              <ListingCard {...c} index={i} />
            </div>
          ))}
        </div>
        <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-12 bg-linear-to-l from-canvas to-transparent sm:block" />
      </div>
    </section>
  );
}

// One area-grouped block of the grid — the honest analog of Airbnb's "Popular homes in {city}",
// mapped to Tuloy's real barangay/area data instead of invented categories. Capped to a preview;
// "See all" hands off to the filtered area view so a busy barangay never buries the sections below.
function AreaSection({
  title,
  items,
  onSeeAll,
}: {
  title: string;
  items: ListingCardData[];
  onSeeAll?: () => void;
}) {
  const heading = title === "More stays" ? title : `Stays in ${title}`;
  const hasMore = items.length > SECTION_CAP;
  return (
    <section aria-label={heading}>
      <SectionHeading
        title={heading}
        count={`${items.length} ${items.length === 1 ? "stay" : "stays"}`}
        action={
          hasMore && onSeeAll ? (
            <button
              type="button"
              onClick={onSeeAll}
              className="group inline-flex shrink-0 items-center gap-1 text-button-sm text-primary transition-colors hover:text-primary-active focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              See all {items.length}
              <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </button>
          ) : undefined
        }
      />
      <CardGrid items={items.slice(0, SECTION_CAP)} />
    </section>
  );
}

function SectionHeading({
  id,
  eyebrow,
  title,
  count,
  action,
}: {
  id?: string;
  eyebrow?: string;
  title: string;
  count?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        {eyebrow && (
          <p className="mb-1.5 text-micro-label tracking-wide text-primary uppercase">{eyebrow}</p>
        )}
        <h2 id={id} className="font-display text-display-lg text-ink">
          {title}
        </h2>
      </div>
      {action ?? (count && <span className="shrink-0 text-caption text-muted">{count}</span>)}
    </div>
  );
}

function CardGrid({ items }: { items: ListingCardData[] }) {
  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {items.map((c, i) => (
        <ListingCard key={c.slug} {...c} index={i} />
      ))}
    </div>
  );
}

function AreaChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`shrink-0 rounded-full border px-4 py-1.5 text-button-sm whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
        active
          ? "border-primary bg-primary text-on-primary"
          : "border-hairline bg-canvas text-muted hover:border-border-strong hover:text-ink"
      }`}
    >
      {label}
    </button>
  );
}

// Windowed page numbers: always show first + last, the current page and its neighbours, and an
// ellipsis for the gaps. Prev/Next arrows bracket them.
function pageWindow(current: number, total: number): (number | "…")[] {
  const out: (number | "…")[] = [];
  const left = Math.max(2, current - 1);
  const right = Math.min(total - 1, current + 1);
  out.push(1);
  if (left > 2) out.push("…");
  for (let i = left; i <= right; i++) out.push(i);
  if (right < total - 1) out.push("…");
  if (total > 1) out.push(total);
  return out;
}

function Pagination({
  current,
  total,
  onChange,
}: {
  current: number;
  total: number;
  onChange: (page: number) => void;
}) {
  const arrow =
    "flex size-10 shrink-0 items-center justify-center rounded-full border border-hairline bg-canvas text-ink transition-colors hover:bg-surface-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:text-muted-soft disabled:hover:bg-canvas";

  return (
    <nav
      aria-label="Pagination"
      className="mt-12 flex items-center justify-center gap-1.5 sm:gap-2"
    >
      <button
        type="button"
        onClick={() => onChange(current - 1)}
        disabled={current === 1}
        aria-label="Previous page"
        className={arrow}
      >
        <ChevronLeft className="size-5" />
      </button>

      {pageWindow(current, total).map((p, i) =>
        p === "…" ? (
          <span key={`gap-${i}`} className="px-1 text-body-sm text-muted-soft">
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            aria-current={p === current ? "page" : undefined}
            className={`flex size-10 shrink-0 items-center justify-center rounded-full border text-button-sm tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
              p === current
                ? "border-primary bg-primary text-on-primary"
                : "border-hairline bg-canvas text-ink hover:bg-surface-soft"
            }`}
          >
            {p}
          </button>
        ),
      )}

      <button
        type="button"
        onClick={() => onChange(current + 1)}
        disabled={current === total}
        aria-label="Next page"
        className={arrow}
      >
        <ChevronRight className="size-5" />
      </button>
    </nav>
  );
}
