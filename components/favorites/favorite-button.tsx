"use client";

import { Heart } from "lucide-react";
import { toast } from "sonner";

import { type ListingCardData } from "@/components/marketplace/listing-card";
import { useFavorites } from "./favorites-context";

const BUTTON_SIZE = { sm: "size-9", md: "size-10" } as const;
const ICON_SIZE = { sm: "size-4", md: "size-5" } as const;

// Heart toggle for a single listing. Styled for placement over a photo / dark hero: a translucent
// dark chip with a white heart, flipping to a solid white chip with a filled brand heart when saved.
// The snapshot ({ slug, name, area, coverUrl, fromPrice }) is what gets persisted, so the favourites
// drawer can render the row later without re-fetching.
export function FavoriteButton({
  size = "sm",
  className = "",
  ...item
}: ListingCardData & { size?: "sm" | "md"; className?: string }) {
  const { isFavorite, toggle, mounted } = useFavorites();
  const saved = mounted && isFavorite(item.slug);

  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={saved ? `Remove ${item.name} from favourites` : `Add ${item.name} to favourites`}
      onClick={(e) => {
        // The card heart lives inside the card's <Link> — don't navigate when toggling.
        e.preventDefault();
        e.stopPropagation();
        const wasSaved = isFavorite(item.slug);
        toggle(item);
        if (wasSaved) toast("Removed from favourites");
        else toast.success("Added to favourites");
      }}
      className={`inline-flex ${BUTTON_SIZE[size]} items-center justify-center rounded-full backdrop-blur transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
        saved ? "bg-white text-primary" : "bg-black/30 text-white hover:bg-black/45"
      } ${className}`}
    >
      <Heart className={`${ICON_SIZE[size]} ${saved ? "fill-current" : ""}`} />
    </button>
  );
}
