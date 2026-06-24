"use client";

import "react-day-picker/style.css";

import { Search, SlidersHorizontal, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type CSSProperties } from "react";
import { DayPicker, type DateRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  BOOKING_STATUSES,
  BOOKING_VIEWS,
  STATUS_LABELS,
  VIEW_LABELS,
  type BookingFilters,
  type BookingView,
} from "@/lib/bookings";
import { formatDateShort, fromDateStr, toDateStr } from "@/lib/dates";

import type { Database } from "@/lib/supabase/database.types";
import type { getBookingFilterOptions } from "@/lib/supabase/dal";

type BookingStatus = Database["public"]["Enums"]["booking_status"];
type Options = Awaited<ReturnType<typeof getBookingFilterOptions>>;
type ActiveFilters = BookingFilters & { status: BookingStatus[] };

// Server-driven filter bar for the bookings board. Every control writes to the URL
// (?property=&room=&status=&q=&from=&to=&view=); the page re-reads those params and
// filters on the server, so a filtered view is shareable and survives reload.
export function BookingsFilters({
  options,
  counts,
  view,
  filters,
  resultCount,
}: {
  options: Options;
  counts: Record<BookingView, number>;
  view: BookingView;
  filters: ActiveFilters;
  resultCount: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(false);
  const [q, setQ] = useState(filters.q ?? "");
  const containerRef = useRef<HTMLDivElement>(null);

  // Entrance: mount hidden, flip to shown on the next frame (mirrors ConfirmDialog) so the
  // overlay fades + scales in instead of popping. Opacity/transform only — no layout transition.
  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => setShown(true));
    return () => {
      cancelAnimationFrame(raf);
      setShown(false);
    };
  }, [open]);

  // The panel floats over the list (out of flow), so close it on outside-click or Escape
  // the way a popover should.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Push a set of param changes to the URL, preserving everything else. null/"" deletes.
  function setParams(updates: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v === null || v === "") next.delete(k);
      else next.set(k, v);
    }
    const query = next.toString();
    startTransition(() =>
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }),
    );
  }

  // Debounce the guest search so each keystroke doesn't navigate. Skip the first run
  // (mount) and any time the prop already matches what we'd push.
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    const id = setTimeout(() => {
      if ((filters.q ?? "") !== q.trim()) setParams({ q: q.trim() || null });
    }, 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const property = options.find((p) => p.id === filters.property);
  const rooms = property?.room_types ?? [];

  const range: DateRange | undefined =
    filters.from || filters.to
      ? {
          from: filters.from ? fromDateStr(filters.from) : undefined,
          to: filters.to ? fromDateStr(filters.to) : undefined,
        }
      : undefined;

  function toggleStatus(s: BookingStatus) {
    const set = new Set(filters.status);
    if (set.has(s)) set.delete(s);
    else set.add(s);
    setParams({ status: [...set].join(",") || null });
  }

  const advancedCount =
    (filters.property ? 1 : 0) +
    (filters.room ? 1 : 0) +
    filters.status.length +
    (filters.from || filters.to ? 1 : 0) +
    (filters.q ? 1 : 0);

  // Active-filter summary chips (each removable). Presets/view aren't shown here.
  const chips: { key: string; label: string; onRemove: () => void }[] = [];
  if (property)
    chips.push({
      key: "prop",
      label: property.name,
      onRemove: () => setParams({ property: null, room: null }),
    });
  if (filters.room) {
    const r = rooms.find((x) => x.id === filters.room);
    chips.push({
      key: "room",
      label: r?.name ?? "Room",
      onRemove: () => setParams({ room: null }),
    });
  }
  for (const s of filters.status) {
    chips.push({ key: `s-${s}`, label: STATUS_LABELS[s], onRemove: () => toggleStatus(s) });
  }
  if (filters.from || filters.to) {
    const label =
      filters.from && filters.to
        ? `${formatDateShort(filters.from)} – ${formatDateShort(filters.to)}`
        : filters.from
          ? `From ${formatDateShort(filters.from)}`
          : `Until ${formatDateShort(filters.to!)}`;
    chips.push({ key: "dates", label, onRemove: () => setParams({ from: null, to: null }) });
  }
  if (filters.q)
    chips.push({
      key: "q",
      label: `“${filters.q}”`,
      onRemove: () => {
        setQ("");
        setParams({ q: null });
      },
    });

  function clearAll() {
    setQ("");
    startTransition(() => router.replace(pathname, { scroll: false }));
  }

  return (
    <div ref={containerRef} className="flex flex-col gap-3" aria-busy={pending}>
      {/* Quick views — the daily-driver presets */}
      <div className="flex flex-wrap gap-2">
        {BOOKING_VIEWS.map((key) => {
          const active = view === key;
          const n = counts[key];
          const flag = key === "action" && n > 0;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setParams({ view: key === "upcoming" ? null : key })}
              className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-body-sm transition-colors focus-visible:outline-none ${
                active
                  ? "bg-primary text-on-primary shadow-glow"
                  : flag
                    ? "bg-warning-bg text-warning hover:opacity-90"
                    : "border border-hairline bg-canvas text-muted hover:bg-surface-soft hover:text-ink"
              }`}
            >
              {VIEW_LABELS[key]}
              {n > 0 && (
                <span
                  className={`rounded-full px-1.5 text-caption-sm ${
                    active ? "bg-white/25" : flag ? "bg-warning/20" : "bg-surface-strong text-body"
                  }`}
                >
                  {n}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Controls: search + advanced toggle + clear. The advanced panel is an anchored
          overlay (absolute, out of flow), so opening it floats over the list instead of
          pushing it down — no layout shift. */}
      <div className="relative">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
            <Input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search guest name, phone, email"
              className="h-11 pl-9"
              aria-label="Search bookings by guest"
            />
          </div>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className={`inline-flex h-11 items-center gap-2 rounded-sm border px-3.5 text-body-sm transition-colors ${
              open || advancedCount > 0
                ? "border-ink text-ink"
                : "border-hairline text-muted hover:text-ink"
            }`}
          >
            <SlidersHorizontal className="size-4" />
            Filters
            {advancedCount > 0 && (
              <span className="rounded-full bg-ink px-1.5 text-caption-sm text-canvas">
                {advancedCount}
              </span>
            )}
          </button>
          <span className="ml-auto text-body-sm text-muted">
            {resultCount} {resultCount === 1 ? "booking" : "bookings"}
          </span>
          {advancedCount > 0 && (
            <Button type="button" variant="ghost" size="sm" onClick={clearAll}>
              Clear all
            </Button>
          )}
        </div>

        {/* Advanced filter panel — floats over the list (out of flow), fades + scales in */}
        {open && (
          <div
            className={`absolute top-full right-0 left-0 z-30 mt-2 flex max-h-[70vh] origin-top flex-col gap-5 overflow-y-auto rounded-md border border-hairline bg-canvas p-4 shadow-card transition duration-150 ease-out ${
              shown ? "scale-100 opacity-100" : "scale-95 opacity-0"
            }`}
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5">
                <span className="text-caption text-muted">Property</span>
                <Select
                  value={filters.property ?? ""}
                  onChange={(e) => setParams({ property: e.target.value || null, room: null })}
                  className="h-11 bg-canvas"
                >
                  <option value="">All properties</option>
                  {options.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-caption text-muted">Room type</span>
                <Select
                  value={filters.room ?? ""}
                  onChange={(e) => setParams({ room: e.target.value || null })}
                  disabled={!property}
                  className="h-11 bg-canvas"
                >
                  <option value="">{property ? "All rooms" : "Pick a property first"}</option>
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </Select>
              </label>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-caption text-muted">Status</span>
              <div className="flex flex-wrap gap-2">
                {BOOKING_STATUSES.map((s) => {
                  const active = filters.status.includes(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggleStatus(s)}
                      aria-pressed={active}
                      className={`rounded-full px-3 py-1 text-caption-sm transition-colors ${
                        active
                          ? "bg-ink text-canvas"
                          : "border border-hairline bg-canvas text-muted hover:text-ink"
                      }`}
                    >
                      {STATUS_LABELS[s]}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-caption text-muted">Check-in between</span>
                {(filters.from || filters.to) && (
                  <button
                    type="button"
                    onClick={() => setParams({ from: null, to: null })}
                    className="text-caption-sm text-muted underline transition-colors hover:text-ink"
                  >
                    Clear dates
                  </button>
                )}
              </div>
              <div className="operator-calendar flex justify-center rounded-sm border border-hairline bg-canvas px-1 py-2">
                <DayPicker
                  mode="range"
                  selected={range}
                  onSelect={(next) =>
                    setParams({
                      from: next?.from ? toDateStr(next.from) : null,
                      to: next?.to ? toDateStr(next.to) : null,
                    })
                  }
                  style={
                    {
                      "--rdp-accent-color": "var(--color-primary)",
                      "--rdp-accent-background-color": "var(--color-primary-disabled)",
                      "--rdp-today-color": "var(--color-primary)",
                    } as CSSProperties
                  }
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Active-filter summary (removable), shown even when the panel is closed */}
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {chips.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={c.onRemove}
              className="inline-flex items-center gap-1 rounded-full bg-surface-strong px-2.5 py-1 text-caption-sm text-body transition-colors hover:bg-border-strong"
            >
              {c.label}
              <X className="size-3.5" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
