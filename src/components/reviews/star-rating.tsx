import { IconStar } from "@tabler/icons-react";
import { useId } from "react";

import { REVIEW_RATINGS } from "@/lib/project-reviews";
import type { ReviewRating } from "@/lib/project-reviews";

/** Five native radio buttons, drawn as stars, with arrow-key navigation built in. */
export const StarRatingInput = ({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (rating: ReviewRating) => void;
  value: ReviewRating | null;
}) => {
  const name = useId();

  return (
    <fieldset className="border-none p-0">
      <legend className="sr-only">{label}</legend>
      <div className="flex items-center gap-1">
        {REVIEW_RATINGS.map((rating) => {
          const filled = value !== null && rating <= value;

          return (
            <label className="cursor-pointer" key={rating}>
              <input
                checked={value === rating}
                className="sr-only"
                name={name}
                onChange={() => onChange(rating)}
                type="radio"
                value={rating}
              />
              <span className="focus-within:ring-ring flex items-center rounded-md p-1 focus-within:ring-2 focus-within:outline-none active:scale-90 motion-reduce:transform-none motion-reduce:transition-none">
                <IconStar
                  aria-hidden="true"
                  fill={filled ? "currentColor" : "none"}
                  className={filled ? "text-primary" : "text-muted-foreground"}
                  size={26}
                  stroke={1.6}
                />
                <span className="sr-only">
                  {rating} star{rating === 1 ? "" : "s"}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
};

/** Read-only stars for a saved review or the average rating. */
export const StarRatingDisplay = ({ rating }: { rating: number }) => (
  <span className="inline-flex items-center gap-0.5">
    <span className="sr-only">{rating} out of 5 stars</span>
    {REVIEW_RATINGS.map((star) => (
      <IconStar
        aria-hidden="true"
        fill={star <= Math.round(rating) ? "currentColor" : "none"}
        className={
          star <= Math.round(rating) ? "text-primary" : "text-muted-foreground"
        }
        key={star}
        size={15}
        stroke={1.6}
      />
    ))}
  </span>
);
