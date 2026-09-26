import {
  IconEdit,
  IconFileText,
  IconPlus,
  IconSearchOff,
  IconTrash,
} from "@tabler/icons-react";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { PostFormDialog } from "@/components/admin/post-form-dialog";
import { useAdminPosts } from "@/components/admin/use-admin-posts";
import type { AdminPostRow } from "@/components/admin/use-admin-posts";
import { PostSearchBar } from "@/components/blog/post-search-bar";
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
import type { Post, PostSummary } from "@/lib/posts";

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
});

const formatDate = (value: Date | string) =>
  dateFormatter.format(new Date(value));

interface PostRowProps {
  isMutating: boolean;
  post: AdminPostRow;
  onDelete: (post: PostSummary) => void;
  onEdit: (post: PostSummary) => void;
}

const PostRow = ({ isMutating, post, onDelete, onEdit }: PostRowProps) => (
  <div className="border-border bg-background flex flex-wrap items-start gap-3 rounded-lg border p-3">
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-foreground truncate text-sm font-medium">
          {post.title}
        </p>
        {post.published ? (
          <span className="bg-primary/10 text-primary inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium tracking-wide uppercase">
            Published
          </span>
        ) : (
          <span className="bg-muted text-muted-foreground inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium tracking-wide uppercase">
            Draft
          </span>
        )}
      </div>

      {post.preview ? (
        <p className="text-muted-foreground mt-1 line-clamp-2 text-sm leading-6">
          {post.preview}
        </p>
      ) : null}

      <p className="text-muted-foreground mt-1 truncate text-xs">
        /blog/{post.slug} · Updated {formatDate(post.updatedAt)}
      </p>
    </div>

    <div className="flex shrink-0 items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="min-h-11"
        disabled={isMutating}
        onClick={() => onEdit(post)}
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
    loadPostForEdit,
    onCreated,
    onQueryChange,
    onUpdated,
    posts,
    query,
    removePost,
    reportError,
    searchAvailable,
  } = useAdminPosts();
  const [formOpen, setFormOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PostSummary | null>(null);

  useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

  const openCreate = () => {
    setEditingPost(null);
    setFormOpen(true);
  };

  const openEdit = async (post: PostSummary) => {
    const fullPost = await loadPostForEdit(post);

    if (fullPost) {
      setEditingPost(fullPost);
      setFormOpen(true);
    }
  };

  const isSearchActive = searchAvailable && query.trim().length > 0;

  let content: ReactNode;

  if (isInitialLoading) {
    content = (
      <div aria-busy="true" className="mt-4 grid gap-3">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
    );
  } else if (isSearchActive && posts.length === 0) {
    content = (
      <EmptyState
        variant="inline"
        title="No posts found"
        description={`Nothing matches “${query.trim()}”.`}
        icon={<IconSearchOff size={20} aria-hidden="true" />}
      />
    );
  } else if (posts.length === 0) {
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
              post={post}
              onDelete={setPendingDelete}
              onEdit={openEdit}
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
          <h2
            id="admin-posts-heading"
            className="text-foreground text-lg font-semibold"
          >
            Blog Posts
          </h2>
          <CardDescription>
            Create, edit, and publish blog posts.
          </CardDescription>
          <CardAction>
            <Button
              type="button"
              variant="default"
              size="sm"
              className="min-h-11"
              onClick={openCreate}
            >
              <IconPlus size={16} stroke={1.8} />
              New post
            </Button>
          </CardAction>
        </CardHeader>

        <CardContent>
          {" "}
          {searchAvailable ? (
            <PostSearchBar
              label="Search blog posts, including drafts"
              onQueryChange={onQueryChange}
              placeholder="Search posts…"
              query={query}
            />
          ) : null}
          {/* Announced rather than shown: the list must not be replaced by a
            loading state while the background refresh runs. */}
          <p aria-live="polite" className="sr-only">
            {isRefreshing ? "Refreshing posts" : ""}
          </p>
          {content}
          <PostFormDialog
            open={formOpen}
            onOpenChange={setFormOpen}
            post={editingPost}
            onSaved={(post) => {
              if (editingPost) {
                onUpdated(post);
              } else {
                onCreated(post);
              }

              setEditingPost(null);
            }}
            onError={reportError}
          />
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
              }
            }}
          />
        </CardContent>
      </Card>
    </section>
  );
};

export { AdminPosts };
