import { IconCornerDownRight } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { CommentAuthor } from "@/components/comments/comment-author";
import { CommentHeartButton } from "@/components/comments/comment-heart-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToastError } from "@/hooks/use-toast-error";
import { authClient } from "@/lib/auth-client";
import { buildCommentTree, COMMENT_MAX_LENGTH } from "@/lib/comments";
import type { CommentTreeNode } from "@/lib/comments";
import type { CommentView } from "@/lib/comments.functions";
import { createPostComment, listPostComments } from "@/lib/comments.functions";
import {
  CONTENT_FILTER_MESSAGE,
  containsBlockedWord,
} from "@/lib/content-filter";
import { errorMessage } from "@/lib/form-errors";
import { formatDate } from "@/lib/format";
import { can } from "@/lib/roles";

const COMMENTS_QUERY_KEY = "post-comments";

/** One composer, used for both top-level comments and replies. */
const CommentComposer = ({
  onDone,
  parentId,
  postId,
}: {
  onDone?: () => void;
  parentId?: string;
  postId: string;
}) => {
  const client = useQueryClient();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const fieldId = `comment-${parentId ?? "new"}`;

  const mutation = useMutation({
    mutationFn: () =>
      createPostComment({
        data: { body, parentId, postId },
      }),
    onSuccess: () => {
      toast.success(parentId ? "Reply posted." : "Comment posted.");
      setBody("");
      setError(null);
      onDone?.();
      client.invalidateQueries({ queryKey: [COMMENTS_QUERY_KEY, postId] });
    },
    onError: (cause) =>
      setError(errorMessage(cause, "Could not post your comment.")),
  });

  let submitLabel = parentId ? "Post reply" : "Comment";

  if (mutation.isPending) {
    submitLabel = "Posting…";
  }

  return (
    <form
      className="border-border bg-muted/30 grid gap-2 rounded-lg border p-3"
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
      <Label htmlFor={fieldId}>
        {parentId ? "Write a reply" : "Join the discussion"}
      </Label>
      <Textarea
        aria-invalid={error ? true : undefined}
        id={fieldId}
        maxLength={COMMENT_MAX_LENGTH}
        onChange={(event) => setBody(event.target.value)}
        rows={3}
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
          type="submit"
        >
          {submitLabel}
        </Button>
      </div>
    </form>
  );
};

/** A comment and its replies, with each level indented under its parent. */
const CommentRow = ({
  canHeart,
  node,
  postId,
  signedIn,
}: {
  canHeart: boolean;
  node: CommentTreeNode<CommentView>;
  postId: string;
  signedIn: boolean;
}) => {
  const [replying, setReplying] = useState(false);
  const { comment, replies } = node;

  return (
    <li>
      <article className="py-3 first:pt-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <CommentAuthor
              name={comment.authorName}
              role={comment.authorRole}
            />
            <p className="text-muted-foreground text-xs">
              {formatDate(comment.createdAt)}
            </p>
          </div>
          <CommentHeartButton
            canHeart={canHeart}
            commentId={comment.id}
            count={comment.heartCount}
            hearted={comment.heartedByMe}
            invalidateKey={[COMMENTS_QUERY_KEY, postId]}
          />
        </div>

        <p className="mt-2 text-sm break-words whitespace-pre-wrap">
          {comment.body}
        </p>

        {signedIn ? (
          <Button
            onClick={() => setReplying((current) => !current)}
            size="sm"
            variant="ghost"
          >
            <IconCornerDownRight aria-hidden="true" size={14} />
            Reply
          </Button>
        ) : null}
        {replying ? (
          <div className="mt-2">
            <CommentComposer
              onDone={() => setReplying(false)}
              parentId={comment.id}
              postId={postId}
            />
          </div>
        ) : null}
      </article>

      {replies.length > 0 ? (
        <ul
          className={
            node.depth < 4
              ? "border-border ml-4 grid gap-2 border-l pl-4"
              : "grid gap-2"
          }
        >
          {replies.map((reply) => (
            <CommentRow
              canHeart={canHeart}
              key={reply.comment.id}
              node={reply}
              postId={postId}
              signedIn={signedIn}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
};

/** The comment thread under a blog post. */
export const PostComments = ({ postId }: { postId: string }) => {
  const { data: session } = authClient.useSession();
  const headingId = `post-comments-${postId}`;
  const signedIn = session?.user !== undefined;
  const canHeart = can(session?.user.role, "heartComments");

  const listing = useQuery({
    queryFn: () => listPostComments({ data: { postId } }),
    queryKey: [COMMENTS_QUERY_KEY, postId],
  });

  useToastError(
    listing.isError ? listing.error.message : null,
    `post-comments-${postId}`
  );

  return (
    <Card aria-labelledby={headingId}>
      <CardHeader className="flex flex-wrap items-center justify-between gap-3">
        <CardTitle id={headingId}>Comments</CardTitle>
        {listing.data && listing.data.length > 0 ? (
          <Badge variant="secondary">
            {listing.data.length}{" "}
            {listing.data.length === 1 ? "comment" : "comments"}
          </Badge>
        ) : null}
      </CardHeader>
      <CardContent className="grid gap-5">
        {signedIn ? (
          <CommentComposer postId={postId} />
        ) : (
          <div className="grid gap-2">
            <p className="text-muted-foreground text-sm">
              Sign in to join the discussion.
            </p>
            <a className={buttonVariants({ size: "sm" })} href="/login">
              Sign in
            </a>
          </div>
        )}

        {listing.isPending ? (
          <Skeleton className="h-24 w-full" aria-label="Loading comments" />
        ) : null}
        {listing.isError ? (
          <Button
            onClick={() => {
              listing.refetch();
            }}
            size="sm"
            variant="outline"
          >
            Retry comments
          </Button>
        ) : null}
        {listing.data?.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No comments yet. Start the conversation.
          </p>
        ) : null}
        {listing.data && listing.data.length > 0 ? (
          <ul className="border-border divide-y">
            {buildCommentTree(listing.data).map((node) => (
              <CommentRow
                canHeart={canHeart}
                key={node.comment.id}
                node={node}
                postId={postId}
                signedIn={signedIn}
              />
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
};
