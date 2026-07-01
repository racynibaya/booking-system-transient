import { CornerDownRight } from "lucide-react";

import type { ReviewItem } from "@/components/public/listing-view";
import { ReviewSummary } from "@/components/public/review-summary";
import { AvatarInitials } from "@/components/ui/avatar-initials";
import { StarRating } from "@/components/ui/star-rating";
import { formatDateShort } from "@/lib/dates";

// S5 — public reviews on a listing. Rating summary (average + distribution) + individual review
// cards, each with the host's optional public reply. Renders nothing until there's at least one
// submitted review (empty listings shouldn't show a bare "No reviews yet" block).
export function ReviewsSection({
  avgRating,
  reviewCount,
  reviews,
}: {
  avgRating: number | null;
  reviewCount: number;
  reviews: ReviewItem[];
}) {
  if (reviewCount === 0 || avgRating == null) return null;

  const distribution = [0, 0, 0, 0, 0];
  for (const r of reviews) if (r.rating >= 1 && r.rating <= 5) distribution[r.rating - 1]++;

  return (
    <section id="reviews" className="flex scroll-mt-20 flex-col gap-5">
      <h2 className="text-display-sm tracking-tight text-ink">Guest reviews</h2>

      <ReviewSummary avgRating={avgRating} reviewCount={reviewCount} distribution={distribution} />

      <div className="flex flex-col gap-3">
        {reviews.map((r) => (
          <article
            key={r.id}
            className="flex flex-col gap-3 rounded-md border border-hairline bg-canvas p-5 shadow-e1"
          >
            <div className="flex items-center gap-3">
              <AvatarInitials name={r.guest_name} />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-title-md text-ink">{r.guest_name}</p>
                  <span className="shrink-0 text-caption text-muted">
                    {formatDateShort(r.submitted_at.slice(0, 10))}
                  </span>
                </div>
                <StarRating value={r.rating} />
              </div>
            </div>

            {r.comment && (
              <p className="text-body-md leading-relaxed whitespace-pre-wrap text-ink">
                {r.comment}
              </p>
            )}

            {r.operator_reply && (
              <div className="flex gap-2.5 rounded-md bg-surface-soft p-3.5">
                <CornerDownRight className="mt-0.5 size-4 shrink-0 text-muted" />
                <div className="flex flex-col gap-1">
                  <p className="text-caption font-medium text-muted">Response from the host</p>
                  <p className="text-body-sm leading-relaxed whitespace-pre-wrap text-ink">
                    {r.operator_reply}
                  </p>
                </div>
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
