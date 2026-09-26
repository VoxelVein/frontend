import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { getSession } from "@/lib/auth.functions";

export const Route = createFileRoute("/dashboard")({
  beforeLoad: async ({ location }) => {
    const session = await getSession();
    if (!session) {
      throw redirect({ to: "/login" });
    }
    // Accounts created through Google or GitHub start with a generated
    // username; they pick their own before using the dashboard.
    if (session.user.usernameConfirmed === false) {
      throw redirect({ search: { redirect: location.href }, to: "/welcome" });
    }
    return { session };
  },
  component: Outlet,
});
