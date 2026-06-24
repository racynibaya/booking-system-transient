"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

import { type ListingCardData } from "@/components/marketplace/listing-card";

// Guest favourites live entirely in the browser (no auth) under this one key. A favourite stores
// the full card snapshot taken at save time, so the drawer can render with zero server round-trip.
//
// Backed by a module-level store read through useSyncExternalStore: this gives correct SSR/hydration
// (server + first client render see an empty list, then the real one swaps in — no mismatch), cross-
// tab sync via the `storage` event, and no React context/provider to wire up.
const STORAGE_KEY = "tuloy:favorites";

export type FavoriteItem = ListingCardData & { savedAt: number };

type Store = Record<string, FavoriteItem>;

const EMPTY: Store = {};
const listeners = new Set<() => void>();

// Cache the parsed store so getSnapshot returns a stable reference while the raw string is unchanged
// (useSyncExternalStore loops forever if getSnapshot returns a fresh object every call).
let lastRaw: string | null = null;
let cached: Store = EMPTY;

function getSnapshot(): Store {
  if (typeof window === "undefined") return EMPTY;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return EMPTY; // blocked storage — behave as if nothing is saved
  }
  if (raw === lastRaw) return cached;
  lastRaw = raw;
  try {
    const parsed = raw ? JSON.parse(raw) : {};
    cached = parsed && typeof parsed === "object" ? (parsed as Store) : EMPTY;
  } catch {
    cached = EMPTY;
  }
  return cached;
}

function getServerSnapshot(): Store {
  return EMPTY;
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  // `storage` fires in OTHER tabs only; same-tab changes are pushed via emit() in setStore.
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) onChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

function setStore(next: Store) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // quota / private mode — favourites just won't persist this session.
  }
  listeners.forEach((l) => l());
}

function toggle(item: ListingCardData) {
  const next = { ...getSnapshot() };
  if (next[item.slug]) delete next[item.slug];
  else next[item.slug] = { ...item, savedAt: Date.now() };
  setStore(next);
}

// Returns false during SSR and the first client (hydration) render, true thereafter — without any
// effect. Lets UI gate count pills / saved hearts so they only appear once the store is live.
const noopSubscribe = () => () => {};
function useHydrated() {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

export function useFavorites() {
  const store = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const mounted = useHydrated();

  const favorites = useMemo(
    () => Object.values(store).sort((a, b) => b.savedAt - a.savedAt),
    [store],
  );
  const isFavorite = useCallback((slug: string) => Boolean(store[slug]), [store]);

  return { favorites, count: favorites.length, isFavorite, toggle, mounted };
}
