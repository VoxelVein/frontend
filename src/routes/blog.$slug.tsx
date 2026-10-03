import { IconArrowLeft } from "@tabler/icons-react";
import { createFileRoute, Link, useLoaderData } from "@tanstack/react-router";

import { PostAuthors } from "@/components/blog/post-authors";
import { PostCategoryBadge } from "@/components/blog/post-category";
import { MarkdownBody } from "@/components/markdown-body";
import {
  Breadcrumb,
  BreadcrumbCurrent,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Skeleton } from "@/components/ui/skeleton";
import { MICRO_LABEL_CLASS } from "@/lib/classes";
import type { Post } from "@/lib/posts";
import { postCategoryLabel } from "@/lib/posts";
import { getPost } from "@/lib/posts.functions";

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "long",
});

const formatDate = (value: Date | string) =>
  dateFormatter.format(new Date(value));

/**
 * Whether a post has been revised since it was first published.
 *
 * Two timestamps within the same second are the same instant as far as a reader
 * is concerned, so the comparison is truncated to whole seconds — otherwise
 * every freshly created post would immediately advertise an update.
 */
const wasEdited = (
  createdAt: Date | string,
  updatedAt: Date | string
): boolean => {
  const created = Math.floor(new Date(createdAt).getTime() / 1000);
  const updated = Math.floor(new Date(updatedAt).getTime() / 1000);

  return (
    Number.isFinite(created) && Number.isFinite(updated) && updated > created
  );
};

interface BlogPostLoaderData {
  post: Post | null;
}

/**
 * Where this post sits: the blog, then the category it is filed under.
 *
 * The trail carries no link to the category itself. There is no per-category
 * page — the index filters client-side over the posts it already has — so a
 * crumb that looked clickable would go nowhere. It is marked as the current page
 * instead, which is what it actually is.
 *
 * An uncategorised post shows just "Blog". The trail still orients the reader,
 * and inventing an "Uncategorised" crumb would present a storage detail as a
 * section of the site.
 */
const PostBreadcrumb = ({ category }: { category: string | null }) => {
  const label = postCategoryLabel(category);

  return (
    <Breadcrumb className="mt-4">
      <BreadcrumbList>
        <BreadcrumbItem>
          <Link
            className="hover:text-foreground focus-visible:ring-ring rounded-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
            to="/blog"
          >
            Blog
          </Link>
        </BreadcrumbItem>
        {label === null ? null : (
          <>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbCurrent>{label}</BreadcrumbCurrent>
            </BreadcrumbItem>
          </>
        )}
      </BreadcrumbList>
    </Breadcrumb>
  );
};

const BlogPostPage = () => {
  const { post } = useLoaderData({ from: "/blog/$slug" });

  if (!post) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-14 lg:px-8">
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
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-14 lg:px-8">
      <article>
        <header>
          <PostCategoryBadge category={post.category} />

          <h1 className="text-foreground mt-3 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
            {post.title}
          </h1>

          <PostBreadcrumb category={post.category} />

          {/* The byline and the date are one row because they are both facts
              about provenance, and separating them would push the reader's eye
              away from the thing they came for. */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
            <PostAuthors authors={post.authors} />

            <p className={MICRO_LABEL_CLASS}>
              <time dateTime={new Date(post.createdAt).toISOString()}>
                {formatDate(post.createdAt)}
              </time>
              {wasEdited(post.createdAt, post.updatedAt) ? (
                <>
                  {" · Updated "}
                  <time dateTime={new Date(post.updatedAt).toISOString()}>
                    {formatDate(post.updatedAt)}
                  </time>
                </>
              ) : null}
            </p>
          </div>

          {post.excerpt ? (
            <p className="text-muted-foreground mt-6 max-w-prose text-lg leading-8">
              {post.excerpt}
            </p>
          ) : null}
        </header>

        <div className="markdown-body mt-10">
          <MarkdownBody>{post.content}</MarkdownBody>
        </div>

        <footer className="border-border mt-12 border-t pt-6">
          <Link
            to="/blog"
            className="text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            <IconArrowLeft size={16} aria-hidden="true" />
            All posts
          </Link>
        </footer>
      </article>
    </div>
  );
};

const BlogPostSkeleton = () => (
  <div
    aria-busy="true"
    className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-14 lg:px-8"
  >
    <Skeleton className="h-6 w-24 rounded-full" />
    <Skeleton className="mt-4 h-10 w-3/4" />
    <Skeleton className="mt-4 h-5 w-40" />
    <div className="mt-6 flex items-center gap-3">
      <Skeleton className="size-8 rounded-full" />
      <Skeleton className="h-4 w-32" />
    </div>
    <Skeleton className="mt-10 h-4 w-full" />
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
          ? `${loaderData.post.title} | VoxelVein`
          : "Post not found | VoxelVein",
      },
      ...(loaderData?.post?.excerpt
        ? [{ name: "description", content: loaderData.post.excerpt }]
        : []),
    ],
  }),
  component: BlogPostPage,
});
