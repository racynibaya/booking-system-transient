"use client";

import { Heart } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { useFavorites } from "./favorites-context";
import { FavoritesDrawer } from "./favorites-drawer";

// Header trigger for the favourites drawer. Visible on every breakpoint (acts like a cart icon).
// Label shows from md up; the count pill appears once there's a saved stay (held back until mount
// to avoid a hydration mismatch).
export function FavoritesNav() {
  const { count, mounted } = useFavorites();
  const [open, setOpen] = useState(false);
  const showCount = mounted && count > 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-full px-1.5 py-1 text-nav-link text-muted transition-colors hover:text-ink focus-visible:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <Heart className={`size-5 ${showCount ? "fill-primary text-primary" : ""}`} />
        <span className="hidden md:inline">Favourites</span>
        {showCount && <Badge tone="accent">{count}</Badge>}
      </button>
      <FavoritesDrawer open={open} onClose={() => setOpen(false)} />
    </>
  );
}
