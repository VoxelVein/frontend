import { IconInbox } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { RejectReviewDialog } from "@/components/admin/reject-review-dialog";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { Button } from "@/components/ui/button";
import {
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  Card,
} from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { errorMessage } from "@/lib/form-errors";
import { formatDate } from "@/lib/format";
import type { PendingReview } from "@/lib/project-moderation";
import {
  approveProject,
  listPendingReviews,
} from "@/lib/project-moderation.functions";
import { PROJECT_TYPE_LABELS } from "@/lib/projects";

interface ListState {
  error: string | null;
  isLoading: boolean;
  rows: PendingReview[];
}

const LOADING_STATE: ListState = { error: null, isLoading: true, rows: [] };

const fetchReviews = async (): Promise<ListState> => {
  try {
    return { error: null, isLoading: false, rows: await listPendingReviews() };
  } catch (error) {
    return {
      error: errorMessage(error, "Could not load the review queue."),
      isLoading: false,
      rows: [],
    };
  }
};

const ReviewRow = ({
  isMutating,
  onApprove,
  onReject,
  review,
}: {
  isMutating: boolean;
  onApprove: (review: PendingReview) => void;
  onReject: (review: PendingReview) => void;
  review: PendingReview;
}) => (
  <li className="border-border flex flex-wrap items-start justify-between gap-4 border-b py-4 last:border-b-0">
    <div className="min-w-0 flex-1">
      <p className="text-foreground font-medium">{review.name}</p>
      <p className="text-muted-foreground mt-1 text-sm">{review.summary}</p>
      <p className="text-muted-foreground mt-1 text-sm">
        {PROJECT_TYPE_LABELS[review.type].singular} · {review.category} ·{" "}
        {review.versionCount}{" "}
        {review.versionCount === 1 ? "version" : "versions"} · by{" "}
        {review.ownerName} · submitted {formatDate(review.submittedAt)}
      </p>
    </div>
    <div className="flex shrink-0 gap-2">
      <Button
        type="button"
        size="sm"
        className="min-h-11"
        disabled={isMutating}
        onClick={() => {
          onApprove(review);
        }}
      >
        Approve
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="min-h-11"
        disabled={isMutating}
        onClick={() => {
          onReject(review);
        }}
      >
        Send back
      </Button>
    </div>
  </li>
);

/**
 * The publishing review queue.
 *
 * A project only reaches this list once a creator has asked for it to go
 * public, and it stays hidden from the site until an admin approves it here.
 * The list is ordered oldest request first so nothing waits indefinitely.
 */
export const AdminReviews = ({
  onDecided,
}: {
  /** Called after a decision so the tab badge can drop the resolved row. */
  onDecided: () => Promise<void>;
}) => {
  const [list, setList] = useState<ListState>(LOADING_STATE);
  const { error: loadError, isLoading, rows: reviews } = list;

  const [approving, setApproving] = useState<PendingReview | null>(null);
  const [rejecting, setRejecting] = useState<PendingReview | null>(null);
  const [isMutating, setIsMutating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let isCurrent = true;
    const loadOnMount = async () => {
      const next = await fetchReviews();
      if (isCurrent) {
        setList(next);
      }
    };
    void loadOnMount();
    return () => {
      isCurrent = false;
    };
  }, []);

  const load = async () => {
    setList((current) => ({ ...current, error: null, isLoading: true }));
    setList(await fetchReviews());
  };

  const handleApprove = async () => {
    if (!approving) {
      return;
    }
    const { id, name } = approving;
    setIsMutating(true);
    setActionError(null);
    try {
      await approveProject({ data: { projectId: id } });
      setList((current) => ({
        ...current,
        rows: current.rows.filter((review) => review.id !== id),
      }));
      setApproving(null);
      toast.success(`${name} is now public.`);
      // The row is already gone from the local list, so the parent's count is
      // now stale by one and has to be re-read.
      await onDecided();
    } catch (error) {
      setActionError(errorMessage(error, "Could not approve the project."));
    }
    setIsMutating(false);
  };

  const handleRejected = (projectId: string) => {
    setList((current) => ({
      ...current,
      rows: current.rows.filter((review) => review.id !== projectId),
    }));
    void onDecided();
  };

  let content: ReactNode;

  if (isLoading) {
    content = (
      <div aria-busy="true" className="mt-4 grid gap-3">
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
      </div>
    );
  } else if (loadError) {
    content = <ErrorState message={loadError} onRetry={() => load()} />;
  } else if (reviews.length === 0) {
    content = (
      <EmptyState
        variant="inline"
        title="Nothing waiting for review"
        description="Projects appear here when their creators submit them for publishing, and stay hidden until you approve them."
        icon={<IconInbox size={20} aria-hidden="true" />}
      />
    );
  } else {
    content = (
      <ul className="mt-4">
        {reviews.map((review) => (
          <ReviewRow
            key={review.id}
            isMutating={isMutating}
            onApprove={(target) => {
              setActionError(null);
              setApproving(target);
            }}
            onReject={(target) => {
              setActionError(null);
              setRejecting(target);
            }}
            review={review}
          />
        ))}
      </ul>
    );
  }

  const waiting = `${reviews.length} ${
    reviews.length === 1 ? "project is" : "projects are"
  } waiting, oldest first. None of them are public yet.`;
  const idle =
    "Projects submitted for publishing are held here until a decision is made.";

  return (
    <section aria-labelledby="admin-reviews-heading">
      <Card>
        <CardHeader>
          <h2
            id="admin-reviews-heading"
            className="text-foreground text-lg font-semibold"
          >
            Publishing review
          </h2>
          <CardDescription>
            {reviews.length === 0 ? idle : waiting}
          </CardDescription>
          <CardAction>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-11"
              disabled={isLoading}
              onClick={() => load()}
            >
              Refresh
            </Button>
          </CardAction>
        </CardHeader>

        <CardContent>
          {content}

          <ConfirmDialog
            open={approving !== null}
            onOpenChange={(open) => {
              if (!open) {
                setApproving(null);
              }
            }}
            title="Approve project"
            description={
              approving
                ? `Approve ${approving.name}? It becomes searchable and downloadable by anyone, and ${approving.ownerName} is notified.`
                : ""
            }
            confirmLabel="Approve and publish"
            variant="default"
            pending={isMutating}
            error={actionError}
            onConfirm={handleApprove}
          />

          <RejectReviewDialog
            review={rejecting}
            onOpenChange={(open) => {
              if (!open) {
                setRejecting(null);
              }
            }}
            onRejected={handleRejected}
          />
        </CardContent>
      </Card>
    </section>
  );
};
