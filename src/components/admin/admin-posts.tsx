import {
  IconEdit,
  IconFileText,
  IconPlus,
  IconSearch,
  IconSearchOff,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { useAdminPosts } from "@/components/admin/use-admin-posts";
import type { AdminPostRow } from "@/components/admin/use-admin-posts";
import { EmptyState } from "@/components/empty-state";
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
import type { PostSummary } from "@/lib/posts";
import { relativeTime } from "@/lib/relative-time";

/**
 * Status as a badge, in the same shape the admin users tab uses.
 *
 * Published is the accent because it is the one an admin is usually checking
 * for; a draft recedes rather than shouting.
 */
const StatusBadge = ({ published }: { published: boolean }) => (
  <span
    className={
      published
        ? "border-primary/20 bg-primary/10 text-primary inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-xs font-medium tracking-wide uppercase"
        : "border-border bg-muted text-muted-foreground inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-xs font-medium tracking-wide uppercase"
    }
  >
    {published ? "Published" : "Draft"}
  </span>
);

const PostRow = ({
  isMutating,
  loadedAt,
  post,
  onDelete,
}: {
  isMutating: boolean;
  loadedAt: number;
  post: AdminPostRow;
  onDelete: (post: PostSummary) => void;
}) => (
  <div className="border-border bg-muted/40 flex items-start gap-3 rounded-lg border p-3">
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-foreground truncate text-sm font-medium">
          {post.title}
        </p>
        <StatusBadge published={post.published} />
      </div>

      {post.preview ? (
        <p className="text-muted-foreground mt-1 line-clamp-2 text-sm leading-6">
          {post.preview}
        </p>
      ) : null}

      {/* Relative time, because "updated 3 days ago" is what an admin is
          actually judging freshness by. */}
      <p className="text-muted-foreground mt-1 truncate text-xs">
        /blog/{post.slug} · Updated {relativeTime(post.updatedAt, loadedAt)}
      </p>
    </div>

    <div className="flex shrink-0 items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="min-h-11"
        disabled={isMutating}
        render={
          <Link params={{ postId: post.id }} to="/admin/posts/$postId/edit" />
        }
      >
        <IconEdit size={16} stroke={1.8} />
        Edit
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="min-h-11 min-w-11"
        aria-label={`Delete ${post.title}`}
        disabled={isMutating}
        onClick={() => onDelete(post)}
      >
        <IconTrash size={16} stroke={1.8} />
      </Button>
    </div>
  </div>
);

const AdminPosts = () => {
  const {
    error,
    isInitialLoading,
    isMutating,
    isRefreshing,
    isSearching,
    loadedAt,
    onQueryChange,
    posts,
    query,
    removePost,
    reportError,
    searchAvailable,
  } = useAdminPosts();
  const [pendingDelete, setPendingDelete] = useState<PostSummary | null>(null);

  useEffect(() => {
    if (error) {
      reportError(error);
    }
  }, [error, reportError]);

  const navigate = useNavigate();

  const isSearchActive = searchAvailable && query.trim().length > 0;
  const postCount = posts.length;
  const countLabel = postCount === 1 ? "post" : "posts";

  let content: ReactNode;

  if (isInitialLoading) {
    content = (
      <div aria-busy="true" className="mt-4 grid gap-3">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
    );
  } else if (isSearchActive && postCount === 0) {
    content = (
      <EmptyState
        variant="inline"
        title="No posts found"
        description={`Nothing matches “${query.trim()}”.`}
        icon={<IconSearchOff size={20} aria-hidden="true" />}
      />
    );
  } else if (postCount === 0) {
    content = (
      <EmptyState
        variant="inline"
        title="No posts yet"
        description="Create your first blog post to get started."
        icon={<IconFileText size={20} aria-hidden="true" />}
      />
    );
  } else {
    content = (
      <ul
        aria-busy={isSearching}
        aria-label="Blog posts"
        className="mt-4 grid gap-3"
      >
        {posts.map((post) => (
          <li key={post.id}>
            <PostRow
              isMutating={isMutating}
              loadedAt={loadedAt}
              post={post}
              onDelete={setPendingDelete}
            />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <section aria-labelledby="admin-posts-heading">
      <Card>
        <CardHeader>
          <div className="grid gap-1">
            <h2
              id="admin-posts-heading"
              className="text-foreground text-lg font-semibold"
            >
              Blog posts
            </h2>
            {/* The count sits in the description so the header states what is
                actually listed, the way the sessions panel does. */}
            <CardDescription>
              {postCount > 0
                ? `${postCount} ${countLabel} · create, edit, and publish.`
                : "Create, edit, and publish blog posts."}
            </CardDescription>
          </div>
          <CardAction>
            <Button
              type="button"
              variant="default"
              size="sm"
              className="min-h-11"
              onClick={() => {
                void navigate({ to: "/admin/posts/new" });
              }}
            >
              <IconPlus size={16} stroke={1.8} />
              New post
            </Button>
          </CardAction>
        </CardHeader>

        <CardContent>
          {searchAvailable ? (
            /* The same search-with-a-clear affordance as the sessions panel,
               rather than a bare input. */
            <div className="relative">
              <IconSearch
                aria-hidden="true"
                className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
              />
              <input
                type="search"
                value={query}
                aria-label="Search blog posts, including drafts"
                placeholder="Search posts…"
                className="border-border bg-background focus-visible:ring-ring focus-visible:ring-ring/50 h-11 w-full rounded-lg border pr-10 pl-9 text-sm focus-visible:ring-3 focus-visible:outline-none"
                onChange={(event) => {
                  onQueryChange(event.target.value);
                }}
              />
              {query ? (
                <button
                  type="button"
                  aria-label="Clear search"
                  className="text-muted-foreground hover:text-foreground focus-visible:ring-ring absolute top-1/2 right-2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md focus-visible:ring-2 focus-visible:outline-none"
                  onClick={() => onQueryChange("")}
                >
                  <IconX size={14} aria-hidden="true" />
                </button>
              ) : null}
            </div>
          ) : null}

          {/* Announced rather than shown: the list must not be replaced by a
              loading state while the background refresh runs. */}
          <p aria-live="polite" className="sr-only">
            {isRefreshing ? "Refreshing posts" : ""}
          </p>

          {content}

          <ConfirmDialog
            open={pendingDelete !== null}
            onOpenChange={(open) => {
              if (!open) {
                setPendingDelete(null);
              }
            }}
            title="Delete post"
            description={
              pendingDelete
                ? `Permanently delete "${pendingDelete.title}"? This cannot be undone.`
                : ""
            }
            confirmLabel="Delete post"
            pending={isMutating}
            onConfirm={() => {
              if (pendingDelete) {
                void removePost(pendingDelete);
                toast.success("Post deleted.");
              }
            }}
          />
        </CardContent>
      </Card>
    </section>
  );
};

export { AdminPosts };
