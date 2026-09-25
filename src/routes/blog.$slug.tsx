import { IconArrowLeft } from "@tabler/icons-react";
import { Markdown } from "@tanstack/markdown/react";
import { createFileRoute, Link, useLoaderData } from "@tanstack/react-router";

import { Skeleton } from "@/components/ui/skeleton";
import type { Post } from "@/lib/posts";
import { getPost } from "@/lib/posts.functions";

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "long",
});

const formatDate = (value: Date | string) =>
  dateFormatter.format(new Date(value));

interface BlogPostLoaderData {
  post: Post | null;
}

const BlogPostPage = () => {
  const { post } = useLoaderData({ from: "/blog/$slug" });

  if (!post) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 sm:py-14">
        <h1 className="text-foreground text-3xl font-bold tracking-tight sm:text-4xl">
          Post not found
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          The post you are looking for does not exist or may have been removed.
        </p>
        <Link
          to="/blog"
          className="text-primary focus-visible:ring-ring mt-6 inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium hover:underline focus-visible:ring-2 focus-visible:outline-none"
        >
          <IconArrowLeft size={16} aria-hidden="true" />
          Back to blog
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 sm:py-14">
      <Link
        to="/blog"
        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium focus-visible:ring-2 focus-visible:outline-none"
      >
        <IconArrowLeft size={16} aria-hidden="true" />
        Back to blog
      </Link>

      <article className="mt-4">
        <header>
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            {formatDate(post.createdAt)}
          </p>
          <h1 className="text-foreground mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            {post.title}
          </h1>
          {post.excerpt ? (
            <p className="text-muted-foreground mt-4 text-base leading-7">
              {post.excerpt}
            </p>
          ) : null}
        </header>

        <div className="markdown-body mt-8">
          <Markdown>{post.content}</Markdown>
        </div>
      </article>
    </div>
  );
};

const BlogPostSkeleton = () => (
  <div
    aria-busy="true"
    className="mx-auto max-w-2xl px-4 py-12 sm:px-6 sm:py-14"
  >
    <Skeleton className="h-5 w-24" />
    <Skeleton className="mt-4 h-10 w-3/4" />
    <Skeleton className="mt-4 h-5 w-full" />
    <Skeleton className="mt-8 h-4 w-full" />
    <Skeleton className="mt-3 h-4 w-full" />
    <Skeleton className="mt-3 h-4 w-2/3" />
  </div>
);

export const Route = createFileRoute("/blog/$slug")({
  pendingComponent: BlogPostSkeleton,
  loader: async ({ params }): Promise<BlogPostLoaderData> => {
    const post = await getPost({ data: { slug: params.slug } });
    return { post };
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData?.post
          ? `${loaderData.post.title} — VoxelVein`
          : "Post not found — VoxelVein",
      },
    ],
  }),
  component: BlogPostPage,
});
