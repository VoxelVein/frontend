import { createFileRoute, redirect } from "@tanstack/react-router";

import { NotificationsPage } from "@/components/notifications/notifications-page";
import { getSession } from "@/lib/auth.functions";

export const Route = createFileRoute("/notifications")({
  beforeLoad: async () => {
    const session = await getSession();

    if (!session) {
      throw redirect({ to: "/login" });
    }

    return { session };
  },
  component: NotificationsPage,
});
