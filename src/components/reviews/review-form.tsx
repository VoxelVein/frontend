import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { StarRatingInput } from "@/components/reviews/star-rating";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage } from "@/lib/form-errors";
import {
  REVIEW_COMMENT_MAX_LENGTH,
  REVIEW_LISTING_QUERY_KEY,
  REVIEW_STATUS_QUERY_KEY,
} from "@/lib/project-reviews";
import type { ReviewRating } from "@/lib/project-reviews";
import { createProjectReview } from "@/lib/project-reviews.functions";

/** The star selector and the optional short note, shown only when eligible. */
export const ReviewForm = ({ projectId }: { projectId: string }) => {
  const client = useQueryClient();
  const [rating, setRating] = useState<ReviewRating | null>(null);
  const [comment, setComment] = useState("");

  const mutation = useMutation({
    mutationFn: () => {
      if (rating === null) {
        throw new Error("Choose a star rating.");
      }

      return createProjectReview({
        data: {
          comment: comment.trim() || undefined,
          projectId,
          rating,
        },
      });
    },
    onSuccess: async () => {
      toast.success("Thanks for your review!");
      setRating(null);
      setComment("");
      await Promise.all([
        client.invalidateQueries({
          queryKey: [REVIEW_LISTING_QUERY_KEY, projectId],
        }),
        client.invalidateQueries({
          queryKey: [REVIEW_STATUS_QUERY_KEY, projectId],
        }),
      ]);
    },
    onError: (error) =>
      toast.error(errorMessage(error, "Could not save your review.")),
  });

  const commentId = `review-comment-${projectId}`;

  return (
    <form
      className="border-border bg-muted/30 grid gap-4 rounded-lg border p-4"
      onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate();
      }}
    >
      <div className="grid gap-2">
        <p className="text-sm font-medium">Your rating</p>
        <StarRatingInput
          label="Your rating"
          onChange={setRating}
          value={rating}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor={commentId}>Comment (optional)</Label>
        <Textarea
          id={commentId}
          maxLength={REVIEW_COMMENT_MAX_LENGTH}
          onChange={(event) => setComment(event.target.value)}
          placeholder="What did you think?"
          rows={3}
          value={comment}
        />
        <p className="text-muted-foreground text-xs">
          Up to {REVIEW_COMMENT_MAX_LENGTH} characters.
        </p>
      </div>

      <div>
        <Button disabled={rating === null || mutation.isPending} type="submit">
          {mutation.isPending ? "Posting review…" : "Post review"}
        </Button>
      </div>
    </form>
  );
};
