import { IconFileText, IconPlus, IconSearchOff } from "@tabler/icons-react";
import { createFileRoute, Link, useLoaderData } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";

import { PostCard } from "@/components/blog/post-card";
import { PostCategoryFilter } from "@/components/blog/post-category-filter";
import { PostSearchBar } from "@/components/blog/post-search-bar";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button-variants";
import { Skeleton } from "@/components/ui/skeleton";
import { useCanManagePosts } from "@/hooks/use-can-manage-posts";
import { usePostSearch } from "@/hooks/use-post-search";
import type { PostSummary } from "@/lib/posts";
import {
  listPosts,
  postSearchAvailable,
  searchPosts,
} from "@/lib/posts.functions";
import { socialMeta } from "@/lib/site";
import { cn } from "@/lib/utils";

const ROUTE_ID = "/blog/";

interface BlogLoaderData {
  posts: PostSummary[];
  searchAvailable: boolean;
}

/**
 * Keeps the posts filed under one category, leaving everything else alone.
 *
 * A category that no longer matches — because a search narrowed the list, or
 * because the last post in it was deleted — yields nothing, and the caller says
 * so rather than quietly falling back to the unfiltered list. Silently ignoring
 * the active filter is the one behaviour that would leave the reader looking at
 * posts they had explicitly ruled out.
 */
const byCategory = (
  posts: PostSummary[],
  category: string | null
): PostSummary[] =>
  category === null
    ? posts
    : posts.filter((post) => post.category === category);

/**
 * How the live-region count reads.
 *
 * "Matches" while a search is in flight, because the list is then a projection
 * of a query rather than the archive itself. A function rather than an inline
 * expression because three cases in a row read as a nested ternary otherwise.
 */
const countLabel = (count: number, isSearching: boolean): string => {
  if (isSearching && count !== 1) {
    return "matches";
  }

  return count === 1 ? "post" : "posts";
};

/**
 * The listing itself.
 *
 * `aria-busy` is only set while a search is in flight, so a background refresh
 * never announces itself as loading and replaces the cards the reader is
 * already looking at.
 */
const CardGrid = ({
  isSearching,
  posts,
}: {
  isSearching: boolean;
  posts: PostSummary[];
}) => (
  <ul
    aria-busy={isSearching}
    aria-label="Blog posts"
    className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
  >
    {posts.map((post) => (
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
  const { posts, searchAvailable } = useLoaderData({ from: ROUTE_ID });
  // Admin only: the route context the admin pages rely on is not set here, and
  // this is a reader page, so the session is read client-side the same way the
  // hero does. The server still guards /admin/posts/new behind its own check.
  const canManagePosts = useCanManagePosts();
  const { hits, isActive, isAvailable, isSearching, onQueryChange, query } =
    usePostSearch({
      availability: searchAvailable,
      fetchResults: (value) => searchPosts({ data: { query: value } }),
    });
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  // Search and category compose rather than replace each other: a reader who
  // picked "Engineering" and then typed a term means both, and having the
  // second silently clear the first would drop them into a wider result set
  // than the one they asked for.
  const results = useMemo(
    () => byCategory(isActive ? hits : posts, activeCategory),
    [activeCategory, hits, isActive, posts]
  );

  const isFiltered = activeCategory !== null;
  const isSearchingHits = isActive && isSearching;

  let content: ReactNode;

  if (isSearchingHits && results.length === 0) {
    content = (
      <div
        aria-busy="true"
        className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        <Skeleton className="h-52 rounded-xl" />
        <Skeleton className="h-52 rounded-xl" />
        <Skeleton className="h-52 rounded-xl" />
      </div>
    );
  } else if (results.length === 0 && isFiltered) {
    // Only reachable alongside a search: the filter offers nothing but
    // categories the listing already has, so an active category with no results
    // can only mean the two filters excluded everything between them.
    content = (
      <Notice
        icon={<IconFileText size={20} aria-hidden="true" />}
        title="Nothing in this category"
      >
        No post matches both that category and your search.
      </Notice>
    );
  } else if (results.length === 0 && isActive) {
    content = (
      <Notice
        icon={<IconSearchOff size={20} aria-hidden="true" />}
        title="No posts found"
      >
        Try a different search term.
      </Notice>
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
    content = <CardGrid isSearching={isSearchingHits} posts={results} />;
  }

  const resultCount = results.length;
  const resultLabel = countLabel(resultCount, isSearchingHits);

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-14 lg:px-8">
      <PageHeader
        title="Blog"
        description="News, updates, and guides from the VoxelVein team."
        action={
          canManagePosts ? (
            <Link
              className={cn(
                buttonVariants({ variant: "default", size: "sm" }),
                "min-h-11"
              )}
              to="/admin/posts/new"
            >
              <IconPlus aria-hidden size={16} />
              New post
            </Link>
          ) : undefined
        }
      />

      {isAvailable ? (
        <PostSearchBar
          label="Search blog posts"
          onQueryChange={onQueryChange}
          placeholder="Search posts…"
          query={query}
        />
      ) : null}

      <PostCategoryFilter
        activeCategory={activeCategory}
        onCategoryChange={setActiveCategory}
        posts={posts}
      />

      {/* Announced rather than shown: filtering narrows a list without
          navigating, so the count changing silently is the one thing a screen
          reader would otherwise never be told about. */}
      <p aria-live="polite" className="sr-only">
        {resultCount} {resultLabel}
      </p>

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

export const Route = createFileRoute("/blog/")({
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
  head: ({ match }) => ({
    meta: [
      { title: "Blog | VoxelVein" },
      ...socialMeta({
        description: "News, updates, and guides from the VoxelVein team.",
        path: match.pathname,
        title: "Blog | VoxelVein",
      }),
    ],
  }),
  component: BlogPage,
});
