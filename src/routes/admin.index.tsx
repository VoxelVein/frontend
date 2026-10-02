import {
  createFileRoute,
  useNavigate,
  useRouteContext,
  useSearch,
} from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { object, optional, parse, picklist } from "valibot";

import { AdminAccountDeletions } from "@/components/admin/admin-account-deletions";
import { AdminNotifications } from "@/components/admin/admin-notifications";
import { AdminPosts } from "@/components/admin/admin-posts";
import { AdminReviews } from "@/components/admin/admin-reviews";
import { AdminSessions } from "@/components/admin/admin-sessions";
import { AdminStorage } from "@/components/admin/admin-storage";
import { AdminUsers } from "@/components/admin/admin-users";
import { PageHeader } from "@/components/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { countUnreadAdminNotifications } from "@/lib/admin-accounts.functions";
import {
  ADMIN_TABS,
  canSeeTab,
  resolveAdminTab,
  visibleTabsFor,
} from "@/lib/admin-tabs";
import { countPendingReviews } from "@/lib/project-moderation.functions";

const adminSearchSchema = object({
  tab: optional(
    picklist([
      "deletions",
      "notifications",
      "posts",
      "reviews",
      "sessions",
      "storage",
      "users",
    ])
  ),
});

type AdminTab = NonNullable<
  ReturnType<typeof parse<typeof adminSearchSchema>>["tab"]
>;

/** Two tabs carry a count badge; the rest are plain text. */
const tabLabel = (
  tab: AdminTab,
  counts: { pending: number; unread: number }
): ReactNode => {
  if (tab === "notifications") {
    return <NotificationsTabLabel unread={counts.unread} />;
  }
  if (tab === "reviews") {
    return <ReviewsTabLabel pending={counts.pending} />;
  }
  return ADMIN_TABS.find((entry) => entry.value === tab)?.label ?? tab;
};

/** Unread inbox size, or null when it could not be loaded. */
const fetchUnreadCount = async (): Promise<number | null> => {
  try {
    return await countUnreadAdminNotifications();
  } catch {
    // The badge is a convenience; the Notifications tab reports load errors.
    return null;
  }
};

/** Projects awaiting a publishing decision, or null when it could not be read. */
const fetchPendingReviewCount = async (): Promise<number | null> => {
  try {
    return await countPendingReviews();
  } catch {
    // Same reasoning as the notifications badge: the Reviews tab is the place
    // that reports load errors, so a failed count must not break the page.
    return null;
  }
};

/**
 * A tab label with an unread/pending count.
 *
 * `srSuffix` supplies the words the screen reader reads after the number, so
 * "3" is announced as "3 unread" or "3 pending" rather than a bare digit.
 */
const CountBadge = ({
  count,
  noun,
  srSuffix,
}: {
  count: number;
  noun: string;
  srSuffix: string;
}) => (
  <>
    {noun}
    {count > 0 ? (
      <>
        <span
          aria-hidden="true"
          className="bg-primary text-primary-foreground inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold"
        >
          {count}
        </span>
        <span className="sr-only">
          , {count} {srSuffix}
        </span>
      </>
    ) : null}
  </>
);

const NotificationsTabLabel = ({ unread }: { unread: number }) => (
  <CountBadge count={unread} noun="Notifications" srSuffix="unread" />
);

const ReviewsTabLabel = ({ pending }: { pending: number }) => (
  <CountBadge count={pending} noun="Reviews" srSuffix="pending" />
);

const AdminPage = () => {
  const navigate = useNavigate();

  /**
   * The role from the route context, not from `authClient.useSession()`.
   *
   * `beforeLoad` already resolved the session and handed it back as context, so
   * reading it from there is free on the server. The client hook resolved
   * *after* first paint, which meant `role` was "user" during SSR — nobody sees
   * every tab — and the panel rendered with no tab strip at all. This also
   * removes the empty-tab state that used to crash on `visibleTabs[0]`.
   */
  const { session } = useRouteContext({ from: "/admin" });
  // Optional on the session shape, so defaulted once here. `hasRole` fails
  // closed on an absent value, so a session without one sees no tabs.
  const role = session.user.role ?? "user";
  const { tab = "users" } = useSearch({ from: "/admin/" });
  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingReviews, setPendingReviews] = useState(0);

  // A tab is hidden rather than disabled, so a moderator never sees a control
  // that would fail. Falls back to the first tab they *can* see, so a
  // bookmarked or shared admin URL lands somewhere usable.
  //
  // `resolveAdminTab` is total: it returns a real tab even when the role can
  // see none, which is what used to crash on `visibleTabs[0].value`.
  const visibleTabs = visibleTabsFor(role);
  const activeTab = resolveAdminTab(tab, role);

  useEffect(() => {
    let isCurrent = true;
    const loadOnMount = async () => {
      // Only the badges this role can actually see are fetched; the others
      // would 403 and the count is a convenience either way.
      const [unread, pending] = await Promise.all([
        canSeeTab("notifications", role)
          ? fetchUnreadCount()
          : Promise.resolve(null),
        canSeeTab("reviews", role)
          ? fetchPendingReviewCount()
          : Promise.resolve(null),
      ]);
      if (!isCurrent) {
        return;
      }
      if (unread !== null) {
        setUnreadCount(unread);
      }
      if (pending !== null) {
        setPendingReviews(pending);
      }
    };
    void loadOnMount();
    return () => {
      isCurrent = false;
    };
  }, [role]);

  const refreshUnreadCount = async () => {
    const unread = await fetchUnreadCount();
    if (unread !== null) {
      setUnreadCount(unread);
    }
  };

  const refreshPendingReviews = async () => {
    const pending = await fetchPendingReviewCount();
    if (pending !== null) {
      setPendingReviews(pending);
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6">
      <PageHeader
        title="Admin Panel"
        description="Manage users, account deletions, notifications, blog posts, and file storage."
      />

      <Tabs
        value={activeTab}
        onValueChange={(value) =>
          navigate({
            to: "/admin",
            search: { tab: value },
            replace: true,
          })
        }
        className="mt-8"
      >
        <TabsList aria-label="Admin sections" className="flex-wrap">
          {visibleTabs.map((entry) => (
            <TabsTrigger key={entry.value} value={entry.value}>
              {tabLabel(entry.value, {
                pending: pendingReviews,
                unread: unreadCount,
              })}
            </TabsTrigger>
          ))}
        </TabsList>

        {visibleTabs.map((entry) => (
          <TabsContent key={entry.value} value={entry.value}>
            {entry.value === "users" ? <AdminUsers /> : null}
            {entry.value === "sessions" ? <AdminSessions /> : null}
            {entry.value === "posts" ? <AdminPosts /> : null}
            {entry.value === "storage" ? <AdminStorage /> : null}
            {entry.value === "notifications" ? (
              <AdminNotifications onReadStateChange={refreshUnreadCount} />
            ) : null}
            {entry.value === "deletions" ? <AdminAccountDeletions /> : null}
            {entry.value === "reviews" ? (
              <AdminReviews onDecided={refreshPendingReviews} />
            ) : null}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export const Route = createFileRoute("/admin/")({
  validateSearch: (search: Record<string, string | undefined>) =>
    parse(adminSearchSchema, search),
  component: AdminPage,
});
