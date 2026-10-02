import { createFileRoute, Outlet } from "@tanstack/react-router";

/**
 * Layout for `/blog`.
 *
 * This route is the parent of `/blog/$slug`, so it renders an `Outlet` rather
 * than page content — the listing itself is the index route, `blog.index.tsx`.
 *
 * When a parent with children renders its own content instead of an `Outlet`,
 * the child never mounts: navigating to `/blog/$slug` swaps the URL and runs
 * the child's loader, but the parent keeps painting the list. That is why the
 * post page needs its own file here rather than living in this one.
 *
 * The listing's loader moved to the index route along with it, which also
 * stops it fetching every post and probing search availability on the way to a
 * single post.
 */
export const Route = createFileRoute("/blog")({
  component: Outlet,
});
