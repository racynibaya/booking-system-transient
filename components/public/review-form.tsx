"use client";

import { Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { submitReview } from "@/app/review/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

// Live descriptive label under the stars — turns the abstract 1–5 into a felt judgement and gives
// immediate cause-effect feedback as the guest hovers/selects (index 0 = nothing chosen yet).
const LABELS = ["Tap a star to rate", "Poor", "Fair", "Good", "Great", "Excellent"];

// Guest's review composer on the tokenized invite page (S5). Star input + optional comment. On
// success the page re-reads (router.refresh) and swaps to the submitted view.
export function ReviewForm({ token }: { token: string }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const shown = hover || rating;

  const submit = () => {
    if (!rating) {
      toast.error("Pick a star rating first.");
      return;
    }
    start(async () => {
      const res = await submitReview({ token, rating, comment });
      if (res.ok) {
        toast.success("Thanks for your review!");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex flex-col gap-6"
    >
      <div className="flex flex-col items-center gap-2.5">
        <div role="radiogroup" aria-label="Star rating" className="flex items-center gap-1.5">
          {[1, 2, 3, 4, 5].map((i) => (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={rating === i}
              aria-label={`${i} star${i > 1 ? "s" : ""}`}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(0)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(0)}
              onClick={() => setRating(i)}
              className="rounded-md p-1 transition-transform duration-150 hover:scale-110 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none active:scale-95 motion-reduce:transition-none motion-reduce:hover:scale-100"
            >
              <Star
                className={`size-10 transition-colors duration-150 ${
                  i <= shown ? "fill-star-rating text-star-rating" : "fill-none text-border-strong"
                }`}
              />
            </button>
          ))}
        </div>
        <p
          aria-live="polite"
          className={`text-body-sm font-medium ${shown ? "text-ink" : "text-muted"}`}
        >
          {LABELS[shown]}
        </p>
      </div>

      <Textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Tell other guests what stood out — the space, the host, the location… (optional)"
        rows={4}
      />

      <div className="flex flex-col gap-2.5 border-t border-hairline pt-4">
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Submitting…" : "Submit review"}
        </Button>
        <p className="text-center text-caption-sm text-muted">
          Your review will be public on the listing.
        </p>
      </div>
    </form>
  );
}
