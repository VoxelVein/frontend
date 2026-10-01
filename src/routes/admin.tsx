import {
  createFileRoute,
  redirect,
  useNavigate,
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
import { authClient } from "@/lib/auth-client";
import { requireAdmin } from "@/lib/auth.functions";
import { countPendingReviews } from "@/lib/project-moderation.functions";
import { can } from "@/lib/roles";
import type { Capability } from "@/lib/roles";

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

/**
 * The capability each tab needs.
 *
 * Named by the job rather than by a rank, so this table reads as policy and the
 * minimum for a tab lives in `CAPABILITY_MINIMUM` with every other one. Adding
 * a tab means naming what it does; the role that implies comes from the table.
 *
 * A tab is hidden rather than disabled, so staff never see a control that
 * would fail. The server functions behind each tab enforce the same bar, so
 * this is presentation and not the security boundary.
 *
 * A moderator's panel is therefore the Reviews tab alone.
 */
const TAB_CAPABILITY = {
  deletions: "manageDeletions",
  notifications: "manageNotifications",
  posts: "managePosts",
  reviews: "reviewProjects",
  sessions: "manageSessions",
  storage: "manageStorage",
  users: "manageUsers",
} as const satisfies Record<AdminTab, Capability>;

const TABS = [
  { label: "Users", value: "users" },
  { label: "Sessions", value: "sessions" },
  { label: "Posts", value: "posts" },
  { label: "Storage", value: "storage" },
  { label: "Notifications", value: "notifications" },
  { label: "Deletions", value: "deletions" },
  { label: "Reviews", value: "reviews" },
] as const satisfies { label: string; value: AdminTab }[];

const canSee = (tab: { value: AdminTab }, role: string) =>
  can(role, TAB_CAPABILITY[tab.value]);

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
  return TABS.find((entry) => entry.value === tab)?.label ?? tab;
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
  // beforeLoad already refused anyone who is not staff; this reads the role
  // to decide which tabs to show.
  const { data: session } = authClient.useSession();
  const { tab = "users" } = useSearch({ from: "/admin" });
  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingReviews, setPendingReviews] = useState(0);
  const role = session?.user.role ?? "user";

  // A tab is hidden rather than disabled, so a moderator never sees a control
  // that would fail. Redirect rather than render nothing, so a bookmarked or
  // shared admin URL lands somewhere usable.
  const visibleTabs = TABS.filter((entry) => canSee(entry, role));
  const activeTab = canSee({ value: tab }, role) ? tab : visibleTabs[0].value;

  useEffect(() => {
    let isCurrent = true;
    const loadOnMount = async () => {
      // Only the badges this role can actually see are fetched; the others
      // would 403 and the count is a convenience either way.
      const [unread, pending] = await Promise.all([
        canSee({ value: "notifications" }, role)
          ? fetchUnreadCount()
          : Promise.resolve(null),
        canSee({ value: "reviews" }, role)
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
