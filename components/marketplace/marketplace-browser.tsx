"use client";

import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useMemo, useRef, useState } from "react";

import { ListingCard, type ListingCardData } from "./listing-card";

const PAGE_SIZE = 12;

// Client-side filtering + pagination over the full loaded set. Right for this density (a handful
// of San Juan operators in prod); if the catalog ever reaches hundreds, move both server-side.
export function MarketplaceBrowser({ listings }: { listings: ListingCardData[] }) {
  const [query, setQuery] = useState("");
  const [area, setArea] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const topRef = useRef<HTMLDivElement>(null);

  const areas = useMemo(
    () => Array.from(new Set(listings.map((l) => l.area).filter(Boolean) as string[])).sort(),
    [listings],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return listings.filter((l) => {
      const matchesArea = !area || l.area === area;
      const matchesQuery =
        !q || l.name.toLowerCase().includes(q) || (l.area?.toLowerCase().includes(q) ?? false);
      return matchesArea && matchesQuery;
    });
  }, [listings, query, area]);

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
      <div className="flex flex-col gap-4">
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={query}
            onChange={(e) => onSearch(e.target.value)}
            aria-label="Search stays by name or area"
            placeholder="Search by name or area"
            className="h-11 w-full rounded-full border border-hairline bg-canvas pr-4 pl-10 text-body-md text-ink placeholder:text-muted-soft focus-visible:border-primary focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
          />
        </div>

        {areas.length > 1 && (
          <div className="flex [scrollbar-width:none] gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            <AreaChip label="All areas" active={area === null} onClick={() => onSelectArea(null)} />
            {areas.map((a) => (
              <AreaChip key={a} label={a} active={area === a} onClick={() => onSelectArea(a)} />
            ))}
          </div>
        )}
      </div>

      <p className="mt-6 mb-6 text-caption text-muted">
        {filtered.length} verified {filtered.length === 1 ? "stay" : "stays"}
      </p>

      {filtered.length === 0 ? (
        <div className="rounded-md border border-hairline bg-surface-soft/50 px-6 py-16 text-center">
          <p className="text-body-md text-muted">No stays match your search.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {pageItems.map((c) => (
              <ListingCard key={c.slug} {...c} />
            ))}
          </div>

          {totalPages > 1 && (
            <Pagination current={current} total={totalPages} onChange={goToPage} />
          )}
        </>
      )}
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
