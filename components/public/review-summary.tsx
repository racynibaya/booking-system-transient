import { Star } from "lucide-react";

import { StarRating } from "@/components/ui/star-rating";

// Shared rating summary (S5): a large average with its star row and a 1–5 distribution. Used on
// both the public listing and the operator Reviews page so the two read identically. `distribution`
// holds counts indexed 0 = 1★ … 4 = 5★.
export function ReviewSummary({
  avgRating,
  reviewCount,
  distribution,
}: {
  avgRating: number;
  reviewCount: number;
  distribution: number[];
}) {
  return (
    <div className="flex flex-col gap-6 rounded-md border border-hairline bg-canvas p-6 shadow-e1 sm:flex-row sm:items-center sm:gap-8">
      <div className="flex items-center gap-4 sm:min-w-36 sm:flex-col sm:items-start sm:gap-1 sm:border-r sm:border-hairline sm:pr-8">
        <span className="text-rating-display text-ink tabular-nums">{avgRating.toFixed(1)}</span>
        <div className="flex flex-col gap-1">
          <StarRating value={avgRating} />
          <span className="text-caption text-muted">
            {reviewCount} review{reviewCount === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2">
        {[5, 4, 3, 2, 1].map((star) => {
          const count = distribution[star - 1] ?? 0;
          const pct = reviewCount ? Math.round((count / reviewCount) * 100) : 0;
          return (
            <div key={star} className="flex items-center gap-2.5">
              <span className="flex w-6 items-center gap-0.5 text-caption text-muted tabular-nums">
                {star}
                <Star className="size-3 fill-star-rating text-star-rating" />
              </span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-strong">
                <div className="h-full rounded-full bg-star-rating" style={{ width: `${pct}%` }} />
              </div>
              <span className="w-5 text-right text-caption-sm text-muted tabular-nums">
                {count}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
