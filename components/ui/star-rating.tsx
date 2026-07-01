import { Star } from "lucide-react";

// Read-only star display (S5). Uses the design-system star color (ink, not gold — see
// --color-star-rating in globals.css), filling Math.round(value) of five. Decorative by default;
// pass a label via the wrapping element's aria-label where the numeric rating matters.
export function StarRating({
  value,
  className = "",
  starClassName = "size-4",
}: {
  value: number;
  className?: string;
  starClassName?: string;
}) {
  const filled = Math.round(value);
  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`} aria-hidden="true">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`${starClassName} ${
            i <= filled ? "fill-star-rating text-star-rating" : "fill-none text-border-strong"
          }`}
        />
      ))}
    </span>
  );
}
