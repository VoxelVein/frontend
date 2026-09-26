import { IconFileText, IconSearchOff } from "@tabler/icons-react";
import { createFileRoute, useLoaderData } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { PostCard } from "@/components/blog/post-card";
import { PostSearchBar } from "@/components/blog/post-search-bar";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { usePostSearch } from "@/hooks/use-post-search";
import type { PostSummary } from "@/lib/posts";
import type { PostSearchDocument } from "@/lib/posts-search";
import {
  listPosts,
  postSearchAvailable,
  searchPosts,
} from "@/lib/posts.functions";

interface BlogLoaderData {
  posts: PostSummary[];
  searchAvailable: boolean;
}

const CardGrid = ({
  hits,
  isSearching,
  posts,
  useHits,
}: {
  hits: PostSearchDocument[];
  isSearching: boolean;
  posts: PostSummary[];
  useHits: boolean;
}) => (
  <ul
    aria-busy={useHits && isSearching}
    aria-label="Blog posts"
    className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
  >
    {useHits
      ? hits.map((hit) => (
          <li key={hit.id}>
            <PostCard post={hit} />
          </li>
        ))
      : posts.map((post) => (
          <li key={post.id}>
            <PostCard post={post} />
          </li>
        ))}
  </ul>
);

const Notice = ({
  children,
  icon,
  title,
}: {
  children: ReactNode;
  icon: ReactNode;
  title: string;
}) => (
  <div className="border-border bg-muted/40 mt-8 rounded-xl border p-6 text-center">
    <div className="border-border bg-background text-muted-foreground mx-auto mb-3 flex size-11 items-center justify-center rounded-xl border">
      {icon}
    </div>
    <p className="text-foreground text-sm font-medium">{title}</p>
    <div className="text-muted-foreground mt-1 text-sm">{children}</div>
  </div>
);

const BlogPage = () => {
  const { posts, searchAvailable } = useLoaderData({ from: "/blog" });
  const {
    error,
    hits,
    isActive,
    isAvailable,
    isSearching,
    onQueryChange,
    query,
  } = usePostSearch({
    availability: searchAvailable,
    fetchResults: (value) => searchPosts({ data: { query: value } }),
  });

  let content: ReactNode;

  if (isActive && isSearching && hits.length === 0) {
    content = (
      <div
        aria-busy="true"
        className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        <Skeleton className="h-44 rounded-xl" />
        <Skeleton className="h-44 rounded-xl" />
        <Skeleton className="h-44 rounded-xl" />
      </div>
    );
  } else if (isActive && hits.length === 0) {
    content = (
      <Notice
        icon={<IconSearchOff size={20} aria-hidden="true" />}
        title="No posts found"
      >
        Try a different search term.
      </Notice>
    );
  } else if (isActive) {
    content = (
      <CardGrid hits={hits} isSearching={isSearching} posts={posts} useHits />
    );
  } else if (posts.length === 0) {
    content = (
      <Notice
        icon={<IconFileText size={20} aria-hidden="true" />}
        title="No posts yet"
      >
        Check back soon for updates.
      </Notice>
    );
  } else {
    content = (
      <CardGrid
        hits={hits}
        isSearching={isSearching}
        posts={posts}
        useHits={false}
      />
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-14 lg:px-8">
      <PageHeader
        title="Blog"
        description="News, updates, and guides from the VoxelVein team."
      />

      {isAvailable ? (
        <PostSearchBar
          label="Search blog posts"
          onQueryChange={onQueryChange}
          placeholder="Search posts…"
          query={query}
        />
      ) : null}

      {error ? (
        <p className="text-destructive mt-8 text-sm" role="alert">
          {error}
        </p>
      ) : null}

      {content}
    </div>
  );
};

const BlogSkeleton = () => (
  <div
    aria-busy="true"
    className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-14 lg:px-8"
  >
    <Skeleton className="h-9 w-24" />
    <Skeleton className="mt-3 h-5 w-72 max-w-full" />
    <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Skeleton className="h-44 rounded-xl" />
      <Skeleton className="h-44 rounded-xl" />
      <Skeleton className="h-44 rounded-xl" />
    </div>
  </div>
);

export const Route = createFileRoute("/blog")({
  pendingComponent: BlogSkeleton,
  loader: async (): Promise<BlogLoaderData> => {
    // The listing comes from Postgres so the page always renders. Search is
    // probed separately and only enables the search field when it can deliver.
    const [posts, searchAvailable] = await Promise.all([
      listPosts({ data: {} }),
      postSearchAvailable(),
    ]);

    return { posts, searchAvailable };
  },
  head: () => ({
    meta: [{ title: "Blog — VoxelVein" }],
  }),
  component: BlogPage,
});
