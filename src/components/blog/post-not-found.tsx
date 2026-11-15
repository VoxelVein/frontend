import { IconArrowLeft } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";

export const BlogPostNotFound = () => (
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
