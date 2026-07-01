import { Star } from "lucide-react";

import { ReviewReplyBox } from "@/components/app/review-reply-box";
import { ReviewSummary } from "@/components/public/review-summary";
import { AvatarInitials } from "@/components/ui/avatar-initials";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StarRating } from "@/components/ui/star-rating";
import { formatDateShort } from "@/lib/dates";
import { getReviews, mintReviewInvites, requireUser } from "@/lib/supabase/dal";

// S5 — the operator's Reviews page. On load it lazily mints review invites for finished stays (and
// emails those guests their review link, best-effort), then lists the reviews that have come back.
// The operator can post one public reply per review; it shows on the listing.
export default async function ReviewsPage() {
  await requireUser();
  await mintReviewInvites();
  const reviews = await getReviews();

  if (reviews.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Reviews" description="Guest reviews of your stays." />
        <EmptyState
          icon={Star}
          title="No reviews yet"
          description="After a guest checks out, they're invited to review their stay. Reviews — and your replies — show on your public listing."
        />
      </div>
    );
  }

  const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
  const distribution = [0, 0, 0, 0, 0];
  for (const r of reviews) if (r.rating >= 1 && r.rating <= 5) distribution[r.rating - 1]++;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Reviews"
        description="Guest reviews of your stays. Reply once to each — your reply shows publicly on your listing."
      />

      <ReviewSummary avgRating={avg} reviewCount={reviews.length} distribution={distribution} />

      <div className="flex flex-col gap-3">
        {reviews.map((r) => (
          <article
            key={r.id}
            className="flex flex-col gap-3 rounded-md border border-hairline bg-canvas p-5 shadow-e1"
          >
            <div className="flex items-center gap-3">
              <AvatarInitials name={r.guestName} />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-title-md text-ink">{r.guestName}</p>
                  <span className="shrink-0 text-caption text-muted">
                    {formatDateShort(r.submittedAt.slice(0, 10))}
                  </span>
                </div>
                <StarRating value={r.rating} />
                <p className="text-caption text-muted">{r.propertyName}</p>
              </div>
            </div>

            {r.comment && (
              <p className="text-body-md leading-relaxed whitespace-pre-wrap text-ink">
                {r.comment}
              </p>
            )}

            {r.operatorReply && (
              <div className="rounded-md bg-surface-soft p-3.5">
                <p className="text-caption font-medium text-muted">Your reply</p>
                <p className="mt-1 text-body-sm whitespace-pre-wrap text-ink">{r.operatorReply}</p>
              </div>
            )}

            <ReviewReplyBox reviewId={r.id} existingReply={r.operatorReply} />
          </article>
        ))}
      </div>
    </div>
  );
}
