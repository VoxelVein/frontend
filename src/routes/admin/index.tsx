import {
  createFileRoute,
  useNavigate,
  useRouteContext,
  useSearch,
} from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { object, optional, picklist, safeParse } from "valibot";

import { AdminAccountDeletions } from "@/components/admin/admin-account-deletions";
import { AdminNotifications } from "@/components/admin/admin-notifications";
import { AdminPosts } from "@/components/admin/admin-posts";
import { AdminReports } from "@/components/admin/admin-reports";
import { AdminReviews } from "@/components/admin/admin-reviews";
import { AdminSessions } from "@/components/admin/admin-sessions";
import { AdminMobileNav, AdminSidebar } from "@/components/admin/admin-sidebar";
import type { AdminTabCounts } from "@/components/admin/admin-sidebar";
import { AdminStorage } from "@/components/admin/admin-storage";
import { AdminTickets } from "@/components/admin/admin-tickets";
import { AdminTransfers } from "@/components/admin/admin-transfers";
import { AdminUsers } from "@/components/admin/admin-users";
import { PageHeader } from "@/components/page-header";
import { countUnreadAdminNotifications } from "@/lib/admin-accounts.functions";
import { canSeeTab, resolveAdminTab, visibleTabsFor } from "@/lib/admin-tabs";
import type { AdminTab } from "@/lib/admin-tabs";
import { countPendingReviews } from "@/lib/project-moderation.functions";
import { countOpenReports } from "@/lib/reports.functions";

const adminSearchSchema = object({
  tab: optional(
    picklist([
      "deletions",
      "notifications",
      "posts",
      "reports",
      "reviews",
      "sessions",
      "storage",
      "tickets",
      "transfers",
      "users",
    ])
  ),
});

/** Unread inbox size, or null when it could not be loaded. */
const fetchUnreadCount = async (): Promise<number | null> => {
  try {
    return await countUnreadAdminNotifications();
  } catch {
    // The badge is a convenience; the Notifications section reports load errors.
    return null;
  }
};

/** Reports awaiting a decision, or null when it could not be read. */
const fetchOpenReportCount = async (): Promise<number | null> => {
  try {
    return await countOpenReports();
  } catch {
    // Same reasoning as the other badges: this section reports load errors, so a
    // failed count must not break the page.
    return null;
  }
};

/** Projects awaiting a publishing decision, or null when it could not be read. */
const fetchPendingReviewCount = async (): Promise<number | null> => {
  try {
    return await countPendingReviews();
  } catch {
    // Same reasoning as the notifications badge: Reviews is the place that
    // reports load errors, so a failed count must not break the page.
    return null;
  }
};

const AdminPage = () => {
  const navigate = useNavigate();
  const { session } = useRouteContext({ from: "/admin" });
  // Optional on the session shape, so defaulted once here. `hasRole` fails
  // closed on an absent value, so a session without one sees no sections.
  const role = session.user.role ?? "user";
  const { tab = "users" } = useSearch({ from: "/admin/" });

  const [counts, setCounts] = useState<AdminTabCounts>({
    open: 0,
    pending: 0,
    unread: 0,
  });

  // A section is hidden rather than disabled, so a moderator never sees a
  // control that would fail. Falls back to the first one they *can* see, so a
  // bookmarked or shared admin URL lands somewhere usable.
  const visibleTabs = visibleTabsFor(role);
  const activeTab = resolveAdminTab(tab, role);

  const activeLabel =
    visibleTabs.find((entry) => entry.value === activeTab)?.label ??
    "Admin section";

  const selectTab = (next: AdminTab) => {
    // The search parameter is still the source of truth, so links to a specific
    // section keep working and the browser's back button still moves between
    // them. `replace` keeps the panel from filling history with section hops.
    void navigate({
      to: "/admin",
      search: { tab: next },
      replace: true,
    });
  };

  useEffect(() => {
    let isCurrent = true;

    const loadOnMount = async () => {
      // Only the badges this role can actually see are fetched; the others
      // would 403 and the count is a convenience either way.
      const [unread, pending, open] = await Promise.all([
        canSeeTab("notifications", role)
          ? fetchUnreadCount()
          : Promise.resolve(null),
        canSeeTab("reviews", role)
          ? fetchPendingReviewCount()
          : Promise.resolve(null),
        canSeeTab("reports", role)
          ? fetchOpenReportCount()
          : Promise.resolve(null),
      ]);

      if (!isCurrent) {
        return;
      }

      setCounts((current) => ({
        open: open ?? current.open,
        pending: pending ?? current.pending,
        unread: unread ?? current.unread,
      }));
    };

    void loadOnMount();

    return () => {
      isCurrent = false;
    };
  }, [role]);

  const refreshUnreadCount = async () => {
    const unread = await fetchUnreadCount();

    if (unread !== null) {
      setCounts((current) => ({ ...current, unread }));
    }
  };

  const refreshPendingReviews = async () => {
    const pending = await fetchPendingReviewCount();

    if (pending !== null) {
      setCounts((current) => ({ ...current, pending }));
    }
  };

  const refreshOpenReports = async () => {
    const open = await fetchOpenReportCount();

    if (open !== null) {
      setCounts((current) => ({ ...current, open }));
    }
  };

  const navProps = {
    activeTab,
    counts,
    onSelectTab: selectTab,
    tabs: visibleTabs,
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <PageHeader
        title="Admin Panel"
        description="Manage users, account deletions, notifications, blog posts, and file storage."
        action={<AdminMobileNav {...navProps} />}
      />

      <div className="mt-8 flex flex-col items-start gap-6 lg:flex-row lg:gap-8">
        <AdminSidebar {...navProps} />

        <section aria-label={activeLabel} className="min-w-0 flex-1">
          {activeTab === "users" ? <AdminUsers /> : null}
          {activeTab === "sessions" ? <AdminSessions /> : null}
          {activeTab === "posts" ? <AdminPosts /> : null}
          {activeTab === "storage" ? <AdminStorage /> : null}
          {activeTab === "notifications" ? (
            <AdminNotifications onReadStateChange={refreshUnreadCount} />
          ) : null}
          {activeTab === "deletions" ? <AdminAccountDeletions /> : null}
          {activeTab === "reviews" ? (
            <AdminReviews onDecided={refreshPendingReviews} />
          ) : null}
          {activeTab === "reports" ? (
            <AdminReports onResolved={refreshOpenReports} />
          ) : null}
          {activeTab === "tickets" ? <AdminTickets /> : null}
          {activeTab === "transfers" ? <AdminTransfers /> : null}
        </section>
      </div>
    </div>
  );
};

export const Route = createFileRoute("/admin/")({
  validateSearch: (search: Record<string, string | undefined>) => {
    // `safeParse` never throws: an unknown or stale `?tab=` value (for example
    // from a bookmark after a tab was removed) falls back to the default tab
    // instead of surfacing a generic "an error occurred" with no detail.
    const result = safeParse(adminSearchSchema, search);

    return result.success ? result.output : { tab: "users" };
  },
  component: AdminPage,
});
