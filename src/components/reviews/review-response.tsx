import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { CommentAuthor } from "@/components/comments/comment-author";
import { CommentHeartButton } from "@/components/comments/comment-heart-button";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { REVIEW_RESPONSE_MAX_LENGTH } from "@/lib/comments";
import type { ReviewResponseView } from "@/lib/comments.functions";
import { createReviewResponse } from "@/lib/comments.functions";
import {
  CONTENT_FILTER_MESSAGE,
  containsBlockedWord,
} from "@/lib/content-filter";
import { errorMessage } from "@/lib/form-errors";
import { formatDate } from "@/lib/format";
import { REVIEW_LISTING_QUERY_KEY } from "@/lib/project-reviews";

/** A creator's answer, shown under the review it answers. */
export const ReviewResponseCard = ({
  canHeart,
  projectId,
  response,
}: {
  canHeart: boolean;
  projectId: string;
  response: ReviewResponseView;
}) => (
  <div className="border-border bg-muted/30 ml-3 rounded-r-lg border-l-2 pl-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <CommentAuthor name={response.authorName} role={response.authorRole} />
        <p className="text-muted-foreground text-xs">
          {formatDate(response.createdAt)}
        </p>
      </div>
      <CommentHeartButton
        canHeart={canHeart}
        commentId={response.id}
        count={response.heartCount}
        hearted={response.heartedByMe}
        invalidateKey={[REVIEW_LISTING_QUERY_KEY, projectId]}
      />
    </div>
    <p className="mt-2 text-sm break-words whitespace-pre-wrap">
      {response.body}
    </p>
  </div>
);

/** Shown only to the project creator; the server checks this again. */
export const ReviewResponseForm = ({
  projectId,
  reviewId,
}: {
  projectId: string;
  reviewId: string;
}) => {
  const client = useQueryClient();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const fieldId = `review-response-${reviewId}`;

  const mutation = useMutation({
    mutationFn: () => createReviewResponse({ data: { body, reviewId } }),
    onSuccess: () => {
      toast.success("Response posted.");
      setBody("");
      setError(null);
      client.invalidateQueries({
        queryKey: [REVIEW_LISTING_QUERY_KEY, projectId],
      });
    },
    onError: (cause) =>
      setError(errorMessage(cause, "Could not post your response.")),
  });

  return (
    <form
      className="border-border bg-muted/30 ml-3 grid gap-2 rounded-r-lg border-l-2 pl-3"
      onSubmit={(event) => {
        event.preventDefault();

        if (containsBlockedWord(body)) {
          setError(CONTENT_FILTER_MESSAGE);

          return;
        }

        setError(null);
        mutation.mutate();
      }}
    >
      <Label htmlFor={fieldId}>Respond as the creator</Label>
      <Textarea
        aria-invalid={error ? true : undefined}
        id={fieldId}
        maxLength={REVIEW_RESPONSE_MAX_LENGTH}
        onChange={(event) => setBody(event.target.value)}
        rows={2}
        value={body}
      />
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
      <div>
        <Button
          disabled={body.trim().length === 0 || mutation.isPending}
          size="sm"
          type="submit"
        >
          {mutation.isPending ? "Posting…" : "Post response"}
        </Button>
      </div>
    </form>
  );
};
