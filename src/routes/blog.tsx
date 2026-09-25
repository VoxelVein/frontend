import { IconFileText } from "@tabler/icons-react";
import { createFileRoute, Link, useLoaderData } from "@tanstack/react-router";

import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import type { PostSummary } from "@/lib/posts";
import { listPosts } from "@/lib/posts.functions";

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
});

const formatDate = (value: Date | string) =>
  dateFormatter.format(new Date(value));

interface BlogLoaderData {
  posts: PostSummary[];
}

const BlogPostCard = ({ post }: { post: PostSummary }) => (
  <article className="border-border bg-card rounded-xl border p-6">
    <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
      {formatDate(post.createdAt)}
    </p>
    <h2 className="text-foreground mt-2 text-xl font-semibold tracking-tight">
      <Link
        to="/blog/$slug"
        params={{ slug: post.slug }}
        className="focus-visible:ring-ring rounded-lg focus-visible:ring-2 focus-visible:outline-none"
      >
        {post.title}
      </Link>
    </h2>
    {post.excerpt ? (
      <p className="text-muted-foreground mt-2 text-sm leading-6">
        {post.excerpt}
      </p>
    ) : null}
  </article>
);

const BlogPage = () => {
  const { posts } = useLoaderData({ from: "/blog" });

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 sm:py-14">
      <PageHeader
        title="Blog"
        description="News, updates, and guides from the VoxelVein team."
      />

      {posts.length === 0 ? (
        <div className="border-border bg-muted/40 mt-8 rounded-xl border p-6 text-center">
          <div className="border-border bg-background text-muted-foreground mx-auto mb-3 flex size-11 items-center justify-center rounded-xl border">
            <IconFileText size={20} aria-hidden="true" />
          </div>
          <p className="text-foreground text-sm font-medium">No posts yet</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Check back soon for updates.
          </p>
        </div>
      ) : (
        <ul className="mt-8 grid gap-4">
          {posts.map((post) => (
            <li key={post.id}>
              <BlogPostCard post={post} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const BlogSkeleton = () => (
  <div
    aria-busy="true"
    className="mx-auto max-w-2xl px-4 py-12 sm:px-6 sm:py-14"
  >
    <Skeleton className="h-9 w-24" />
    <Skeleton className="mt-3 h-5 w-72 max-w-full" />
    <div className="mt-8 grid gap-4">
      <Skeleton className="h-32 rounded-xl" />
      <Skeleton className="h-32 rounded-xl" />
    </div>
  </div>
);

export const Route = createFileRoute("/blog")({
  pendingComponent: BlogSkeleton,
  loader: async (): Promise<BlogLoaderData> => {
    const posts = await listPosts({ data: {} });
    return { posts };
  },
  head: () => ({
    meta: [{ title: "Blog — VoxelVein" }],
  }),
  component: BlogPage,
});
