import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { requireAdmin } from "@/lib/auth.functions";

/**
 * Layout for `/admin` and everything under it.
 *
 * A layout renders its children, and nothing else. The tabbed panel is the
 * *index* route (`admin.index.tsx`); the post editor lives at
 * `/admin/posts/*`. This file used to hold the panel itself, which meant it had
 * to decide at render time whether to show tabs or defer to a child — and that
 * conditional silently rendered nothing when the check disagreed with the
 * router, taking the panel with it. A layout cannot fail that way.
 */
export const Route = createFileRoute("/admin")({
  beforeLoad: async () => {
    const session = await requireAdmin();
    if (!session) {
      throw redirect({ to: "/login" });
    }
    return { session };
  },
  component: Outlet,
});
