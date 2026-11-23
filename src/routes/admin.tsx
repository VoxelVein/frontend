import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { InfrastructureWarnings } from "@/components/admin/infrastructure-warnings";
import { requireAdmin } from "@/lib/auth.functions";

/**
 * The warnings sit in this layout rather than in `admin/index.tsx` so they
 * cover the post editor too, which is a child with its own page frame.
 */
const AdminLayout = () => (
  <>
    <InfrastructureWarnings />
    <Outlet />
  </>
);

/**
 * Layout for `/admin` and everything under it.
 *
 * A layout renders its children and the infrastructure warnings above them.
 * The tabbed panel is the
 * *index* route (`admin/index.tsx`); the post editor lives at
 * `/admin/posts/*`. This file used to hold the panel itself, which meant it had
 * to decide at render time whether to show tabs or defer to a child  -  and that
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
  component: AdminLayout,
});
