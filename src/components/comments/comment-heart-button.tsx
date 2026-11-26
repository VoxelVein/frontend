import { IconHeart } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { toggleCommentHeart } from "@/lib/comments.functions";
import { errorMessage } from "@/lib/form-errors";

/**
 * Staff-only heart on a comment.
 *
 * Everyone sees the count; only moderators and admins can add or remove their
 * own heart. The parent decides that from the session and passes `canHeart`,
 * but the server checks the capability again before writing.
 */
export const CommentHeartButton = ({
  canHeart,
  commentId,
  count,
  hearted,
  invalidateKey,
}: {
  canHeart: boolean;
  commentId: string;
  count: number;
  hearted: boolean;
  invalidateKey: readonly unknown[];
}) => {
  const client = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => toggleCommentHeart({ data: { commentId } }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: invalidateKey });
    },
    onError: (error) =>
      toast.error(errorMessage(error, "Could not update the heart.")),
  });

  const label = hearted ? "Remove heart" : "Give heart";

  if (!canHeart) {
    return count > 0 ? (
      <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
        <IconHeart aria-hidden="true" fill="currentColor" size={13} />
        {count}
      </span>
    ) : null;
  }

  return (
    <Button
      aria-label={label}
      disabled={mutation.isPending}
      onClick={() => mutation.mutate()}
      size="sm"
      variant="ghost"
    >
      <IconHeart
        aria-hidden="true"
        fill={hearted ? "currentColor" : "none"}
        size={15}
      />
      {count > 0 ? count : null}
    </Button>
  );
};
