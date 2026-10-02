import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { requirePostAuthor } from "@/lib/auth.functions";

/**
 * Layout for the post editor at `/admin/posts/*`.
 *
 * A separate top-level branch rather than children of `admin.tsx`, because that
 * file renders the tabbed panel and has no `<Outlet />` — nesting the editor
 * under it would either drop the editor or require the panel to know about a
 * route it should never show.
 *
 * The guard is here so both the create and edit pages get it by construction.
 */
export const Route = createFileRoute("/admin/posts")({
  beforeLoad: async () => {
    const session = await requirePostAuthor();
    if (!session) {
      throw redirect({ to: "/login" });
    }
  },
  component: Outlet,
});
