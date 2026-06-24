"use client";

import { Check, ChevronDown, MapPin, Search } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";

// Searchable single-select on the input/select token (h-14, hairline, 8px radius).
// Use instead of the native <Select> when the list is long enough that scrolling a
// native dropdown is painful (e.g. the 41 San Juan barangays): the operator types
// to filter instead of hunting. Controlled — owns no value, only ui state.
export function Combobox({
  options,
  value,
  onChange,
  placeholder = "Select…",
  searchPlaceholder = "Type to filter…",
  emptyLabel = "No match for",
  leadingIcon = true,
  id,
  invalid,
}: {
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  leadingIcon?: boolean;
  id?: string;
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = `${useId()}-list`;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.toLowerCase().includes(q)) : options;
  }, [options, query]);

  // Entrance: mount hidden, flip to shown next frame so the panel fades + scales in
  // (matches the bookings filter panel), then drop focus into the search box.
  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => {
      setShown(true);
      searchRef.current?.focus();
    });
    return () => {
      cancelAnimationFrame(raf);
      setShown(false);
    };
  }, [open]);

  // Close on outside-click, like any popover. (Escape is handled on the panel.)
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Keep the keyboard-active row scrolled into view as it moves.
  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector<HTMLElement>('[data-active="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  function openPanel() {
    setQuery("");
    setActive(Math.max(0, options.indexOf(value)));
    setOpen(true);
  }

  function select(option: string) {
    onChange(option);
    setOpen(false);
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const pick = filtered[active];
      if (pick) select(pick);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-invalid={invalid}
        onClick={() => (open ? setOpen(false) : openPanel())}
        className={`flex h-14 w-full items-center gap-2.5 rounded-sm border bg-canvas px-3.5 text-left text-body-md transition-colors focus-visible:border-2 focus-visible:border-ink focus-visible:outline-none ${
          open ? "border-2 border-ink" : "border-hairline hover:border-border-strong"
        }`}
      >
        {leadingIcon && <MapPin className="size-4 shrink-0 text-muted" />}
        <span className={`min-w-0 flex-1 truncate ${value ? "text-ink" : "text-muted"}`}>
          {value || placeholder}
        </span>
        <ChevronDown
          className={`size-4 shrink-0 text-muted transition-transform duration-150 motion-reduce:transition-none ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div
          onKeyDown={onKeyDown}
          className={`absolute top-full right-0 left-0 z-30 mt-2 origin-top overflow-hidden rounded-md border border-hairline bg-canvas shadow-card transition duration-150 ease-out motion-reduce:transition-none ${
            shown ? "scale-100 opacity-100" : "scale-95 opacity-0"
          }`}
        >
          <div className="border-b border-hairline-soft p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                placeholder={searchPlaceholder}
                className="h-11 w-full rounded-sm border border-hairline bg-surface-soft pr-3 pl-9 text-body-md text-ink transition-colors placeholder:text-muted focus:border-ink focus:bg-canvas focus:outline-none"
              />
            </div>
          </div>

          <div ref={listRef} id={listId} role="listbox" className="max-h-64 overflow-y-auto p-1.5">
            {filtered.length === 0 ? (
              <p className="px-3 py-6 text-center text-body-sm text-muted">
                {emptyLabel} &ldquo;{query.trim()}&rdquo;
              </p>
            ) : (
              filtered.map((option, i) => {
                const selected = option === value;
                const isActive = i === active;
                return (
                  <button
                    key={option}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    data-active={isActive}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => select(option)}
                    className={`flex w-full items-center gap-2 rounded-sm px-3 py-2.5 text-left text-body-md transition-colors ${
                      isActive ? "bg-surface-soft" : ""
                    } ${selected ? "font-medium text-primary" : "text-body"}`}
                  >
                    <span className="min-w-0 flex-1 truncate">{highlight(option, query)}</span>
                    {selected && <Check className="size-4 shrink-0 text-primary" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Embolden the matched span so the eye lands on the typed letters. Color is left to
// inherit (primary when the row is selected, body otherwise).
function highlight(label: string, query: string) {
  const q = query.trim();
  if (!q) return label;
  const idx = label.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return label;
  return (
    <>
      {label.slice(0, idx)}
      <mark className="bg-transparent font-semibold text-ink">
        {label.slice(idx, idx + q.length)}
      </mark>
      {label.slice(idx + q.length)}
    </>
  );
}
