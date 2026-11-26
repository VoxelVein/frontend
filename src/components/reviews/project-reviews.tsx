import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { ReviewForm } from "@/components/reviews/review-form";
import {
  ReviewResponseCard,
  ReviewResponseForm,
} from "@/components/reviews/review-response";
import { StarRatingDisplay } from "@/components/reviews/star-rating";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToastError } from "@/hooks/use-toast-error";
import { authClient } from "@/lib/auth-client";
import { canRespondToReview } from "@/lib/comments";
import { formatDate } from "@/lib/format";
import {
  PROJECT_DOWNLOADED_EVENT,
  REVIEW_LISTING_QUERY_KEY,
  REVIEW_REFRESH_DELAY_MS,
  REVIEW_STATUS_QUERY_KEY,
  refusalMessage,
} from "@/lib/project-reviews";
import type {
  ReviewListing,
  ReviewStatus,
  ReviewView,
} from "@/lib/project-reviews.functions";
import {
  listProjectReviews,
  reviewStatus,
} from "@/lib/project-reviews.functions";
import { can } from "@/lib/roles";

/** Why this account cannot review, or confirmation that it already did. */
const ReviewGate = ({ status }: { status: ReviewStatus }) => {
  const message = refusalMessage(status.reason);

  return (
    <>
      {message ? (
        <div className="grid gap-2">
          <p className="text-muted-foreground text-sm">{message}</p>
          {status.reason === "sign-in" ? (
            <a className={buttonVariants({ size: "sm" })} href="/login">
              Sign in
            </a>
          ) : null}
        </div>
      ) : null}
      {status.hasReviewed ? (
        <p className="text-muted-foreground text-xs">You reviewed this.</p>
      ) : null}
    </>
  );
};

/** The mean rating, when anyone has left one. */
const ReviewSummary = ({ listing }: { listing: ReviewListing }) => {
  if (listing.ratingCount === 0) {
    return null;
  }

  return (
    <Badge className="gap-2" variant="secondary">
      <StarRatingDisplay rating={listing.averageRating ?? 0} />
      {listing.averageRating?.toFixed(1)} · {listing.ratingCount}{" "}
      {listing.ratingCount === 1 ? "review" : "reviews"}
    </Badge>
  );
};

/** The creator's answer, or the form to write one, under a review. */
const ResponseArea = ({
  canHeart,
  ownerId,
  projectId,
  review,
  viewerId,
}: {
  canHeart: boolean;
  ownerId: string | null;
  projectId: string;
  review: ReviewView;
  viewerId: string | undefined;
}) => {
  if (review.response) {
    return (
      <div className="w-full">
        <ReviewResponseCard
          canHeart={canHeart}
          projectId={projectId}
          response={review.response}
        />
      </div>
    );
  }

  if (canRespondToReview(ownerId, viewerId)) {
    return (
      <div className="w-full">
        <ReviewResponseForm projectId={projectId} reviewId={review.id} />
      </div>
    );
  }

  return null;
};

/** The reviews themselves, newest first. */
const ReviewList = ({
  canHeart,
  listing,
  ownerId,
  projectId,
  viewerId,
}: {
  canHeart: boolean;
  listing: ReviewListing | undefined;
  ownerId: string | null;
  projectId: string;
  viewerId: string | undefined;
}) => {
  if (listing === undefined) {
    return <Skeleton className="h-20 w-full" aria-label="Loading reviews" />;
  }

  if (listing.reviews.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No reviews yet. Be the first to share what you think.
      </p>
    );
  }

  return (
    <ul className="border-border divide-y">
      {listing.reviews.map((review) => (
        <li
          className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0"
          key={review.id}
        >
          <div className="grid min-w-0 gap-1.5">
            <StarRatingDisplay rating={review.rating} />
            {review.comment ? (
              <p className="text-sm break-words">{review.comment}</p>
            ) : null}
          </div>
          <div className="text-muted-foreground text-xs">
            <p className="text-foreground text-sm font-medium">
              {review.authorName}
            </p>
            <p>{formatDate(review.createdAt)}</p>
          </div>
          <ResponseArea
            canHeart={canHeart}
            ownerId={ownerId}
            projectId={projectId}
            review={review}
            viewerId={viewerId}
          />
        </li>
      ))}
    </ul>
  );
};

/**
 * Reviews on a public project or server page.
 *
 * Two reads: the listing everyone sees, and the signed-in account's right to
 * post. The latter polls for a few seconds after a download, which is how the
 * five-second gate turns into a usable form without a page reload.
 */
export const ProjectReviews = ({
  ownerId,
  projectId,
}: {
  ownerId: string | null;
  projectId: string;
}) => {
  const { data: session } = authClient.useSession();
  const client = useQueryClient();
  const canHeart = can(session?.user.role, "heartComments");
  const headingId = `project-reviews-${projectId}`;

  useEffect(() => {
    let timer: number | null = null;

    const handleDownload = (event: Event) => {
      if (!(event instanceof CustomEvent) || event.detail !== projectId) {
        return;
      }

      if (timer !== null) {
        window.clearTimeout(timer);
      }

      // The download endpoint records the fetch before redirecting to the file.
      timer = window.setTimeout(() => {
        timer = null;
        client.invalidateQueries({
          queryKey: [REVIEW_STATUS_QUERY_KEY, projectId],
        });
      }, REVIEW_REFRESH_DELAY_MS);
    };

    window.addEventListener(PROJECT_DOWNLOADED_EVENT, handleDownload);

    return () => {
      window.removeEventListener(PROJECT_DOWNLOADED_EVENT, handleDownload);

      if (timer !== null) {
        window.clearTimeout(timer);
      }
    };
  }, [client, projectId]);

  const listing = useQuery({
    queryFn: () => listProjectReviews({ data: { projectId } }),
    queryKey: [REVIEW_LISTING_QUERY_KEY, projectId],
  });

  const status = useQuery({
    queryFn: () => reviewStatus({ data: { projectId } }),
    queryKey: [REVIEW_STATUS_QUERY_KEY, projectId, session?.user.id],
    refetchInterval: (query) =>
      query.state.data?.reason === "cooldown" ? 1000 : false,
  });

  useToastError(
    listing.isError ? listing.error.message : null,
    `project-reviews-list-${projectId}`
  );
  useToastError(
    status.isError ? status.error.message : null,
    `project-reviews-status-${projectId}`
  );

  return (
    <Card aria-labelledby={headingId} size="sm">
      <CardHeader className="flex flex-wrap items-center justify-between gap-3">
        <CardTitle id={headingId}>Reviews</CardTitle>
        {listing.data ? <ReviewSummary listing={listing.data} /> : null}
      </CardHeader>
      <CardContent className="grid gap-5">
        {status.data?.eligible ? <ReviewForm projectId={projectId} /> : null}
        {status.data ? <ReviewGate status={status.data} /> : null}
        {listing.isError ? (
          <Button
            onClick={() => {
              listing.refetch();
            }}
            size="sm"
            variant="outline"
          >
            Retry reviews
          </Button>
        ) : null}
        <ReviewList
          canHeart={canHeart}
          listing={listing.data}
          ownerId={ownerId}
          projectId={projectId}
          viewerId={session?.user.id}
        />
      </CardContent>
    </Card>
  );
};
