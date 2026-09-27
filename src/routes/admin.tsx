import {
  createFileRoute,
  redirect,
  useNavigate,
  useSearch,
} from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
import { requireAdmin } from "@/lib/auth.functions";
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
  const { tab = "users" } = useSearch({ from: "/admin" });
  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingReviews, setPendingReviews] = useState(0);

  useEffect(() => {
    let isCurrent = true;
    const loadOnMount = async () => {
      const [unread, pending] = await Promise.all([
        fetchUnreadCount(),
        fetchPendingReviewCount(),
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
  }, []);

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
        value={tab}
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
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          <TabsTrigger value="posts">Posts</TabsTrigger>
          <TabsTrigger value="storage">Storage</TabsTrigger>
          <TabsTrigger value="notifications">
            <NotificationsTabLabel unread={unreadCount} />
          </TabsTrigger>
          <TabsTrigger value="deletions">Deletions</TabsTrigger>
          <TabsTrigger value="reviews">
            <ReviewsTabLabel pending={pendingReviews} />
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <AdminUsers />
        </TabsContent>

        <TabsContent value="sessions">
          <AdminSessions />
        </TabsContent>

        <TabsContent value="posts">
          <AdminPosts />
        </TabsContent>

        <TabsContent value="storage">
          <AdminStorage />
        </TabsContent>

        <TabsContent value="notifications">
          <AdminNotifications onReadStateChange={refreshUnreadCount} />
        </TabsContent>

        <TabsContent value="deletions">
          <AdminAccountDeletions />
        </TabsContent>

        <TabsContent value="reviews">
          <AdminReviews onDecided={refreshPendingReviews} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export const Route = createFileRoute("/admin")({
  validateSearch: (search: Record<string, string | undefined>) =>
    parse(adminSearchSchema, search),
  beforeLoad: async () => {
    const session = await requireAdmin();
    if (!session) {
      throw redirect({ to: "/login" });
    }
    return { session };
  },
  component: AdminPage,
});
