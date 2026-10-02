import {
  IconBan,
  IconClockX,
  IconSearch,
  IconShield,
  IconTrash,
  IconUser,
  IconUsers,
  IconX,
} from "@tabler/icons-react";
import { useDebouncedValue } from "@tanstack/react-pacer/debouncer";
import { Link } from "@tanstack/react-router";
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/empty-state";
import { RowIcon } from "@/components/row-icon";
import { Button } from "@/components/ui/button";
import {
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  Card,
} from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { authClient } from "@/lib/auth-client";
import { ALL_ROLES, can, canActOn, isRole, ROLE_LABELS } from "@/lib/roles";
import type { Role } from "@/lib/roles";

interface AdminUser {
  banned: boolean | null;
  banReason?: string | null;
  banExpires?: Date | string | null;
  createdAt: Date | string;
  email: string;
  emailVerified: boolean;
  id: string;
  image?: string | null;
  name: string;
  role?: string;
}

interface UsersState {
  /**
   * The most recent failure, or null.
   *
   * Carries its own `id` rather than sitting beside an `errorCount`. The counter
   * existed only to make two identical messages distinct to the toast effect,
   * since a repeated failure leaves the message unchanged; making the failure
   * itself unique removes that coupling instead of working around it.
   */
  failure: { id: number; message: string } | null;
  /** Monotonic, so two identical messages are still two distinct failures. */
  failureId: number;
  isLoading: boolean;
  users: AdminUser[];
}

type UsersAction =
  | { type: "LOAD_START" }
  | { type: "LOAD_SUCCESS"; users: AdminUser[] }
  | { type: "LOAD_ERROR"; error: string }
  | { type: "ROLE_SUCCESS"; userId: string; role: string }
  | { type: "BAN_SUCCESS"; userId: string }
  | { type: "UNBAN_SUCCESS"; userId: string }
  | { type: "REMOVE_SUCCESS"; userId: string }
  | { type: "ACTION_ERROR"; error: string };

const usersReducer = (state: UsersState, action: UsersAction): UsersState => {
  switch (action.type) {
    case "LOAD_START": {
      return { ...state, failure: null, isLoading: true };
    }
    case "LOAD_SUCCESS": {
      return { ...state, failure: null, isLoading: false, users: action.users };
    }
    case "LOAD_ERROR": {
      return {
        ...state,
        failure: { id: state.failureId + 1, message: action.error },
        failureId: state.failureId + 1,
        isLoading: false,
      };
    }
    case "ROLE_SUCCESS": {
      return {
        ...state,
        failure: null,
        users: state.users.map((user) =>
          user.id === action.userId ? { ...user, role: action.role } : user
        ),
      };
    }
    case "BAN_SUCCESS": {
      return {
        ...state,
        failure: null,
        users: state.users.map((user) =>
          user.id === action.userId ? { ...user, banned: true } : user
        ),
      };
    }
    case "UNBAN_SUCCESS": {
      return {
        ...state,
        failure: null,
        users: state.users.map((user) =>
          user.id === action.userId
            ? { ...user, banExpires: null, banReason: null, banned: false }
            : user
        ),
      };
    }
    case "REMOVE_SUCCESS": {
      return {
        ...state,
        failure: null,
        users: state.users.filter((user) => user.id !== action.userId),
      };
    }
    case "ACTION_ERROR": {
      return {
        ...state,
        failure: { id: state.failureId + 1, message: action.error },
        failureId: state.failureId + 1,
      };
    }
    default: {
      return state;
    }
  }
};

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

const formatDate = (value: Date | string) =>
  dateFormatter.format(new Date(value));

/**
 * How many accounts one search returns.
 *
 * Matches the sessions panel. There is no pagination here, so this is the whole
 * result set an admin sees for a query — deliberately small enough to render
 * without the virtualizer, which a fixed 50-row list does not need.
 */
const USER_SEARCH_LIMIT = 50;
const SEARCH_DEBOUNCE_MS = 300;

/**
 * Ban reason the account-deletion flow sets. Such an account is not banned
 * for misconduct: it is waiting to be purged, and only restoring it from the
 * Deletions tab cancels that.
 */
const PENDING_DELETION_BAN_REASON = "pending-deletion";

const badgeBaseClassName =
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium tracking-wide uppercase";

const UserStatusBadge = ({
  isBanned,
  isPendingDeletion,
}: {
  isBanned: boolean;
  isPendingDeletion: boolean;
}) => {
  if (isPendingDeletion) {
    return (
      <span
        className={`border-border bg-background text-foreground ${badgeBaseClassName}`}
      >
        <IconClockX size={10} stroke={2} aria-hidden="true" />
        Scheduled for deletion
      </span>
    );
  }
  if (isBanned) {
    return (
      <span
        className={`border-destructive/30 bg-destructive/10 text-destructive ${badgeBaseClassName}`}
      >
        <IconBan size={10} stroke={2} aria-hidden="true" />
        Banned
      </span>
    );
  }
  return null;
};

interface BanActionProps {
  isBanned: boolean;
  /** False for a moderator, who holds no account capability at all. */
  canManageUsers: boolean;
  /**
   * Blocks a ban: either a request is in flight, or the row is off-limits
   * because it is your own account or outranks you. Deliberately not applied
   * to unban, which has to stay available on your own row.
   */
  isBanInert: boolean;
  isMutating: boolean;
  isPendingDeletion: boolean;
  user: AdminUser;
  onBan: (user: AdminUser) => void;
  onUnban: (userId: string) => void;
}

const BanAction = ({
  isBanned,
  isBanInert,
  canManageUsers,
  isMutating,
  isPendingDeletion,
  user,
  onBan,
  onUnban,
}: BanActionProps) => {
  if (isPendingDeletion) {
    // Unbanning would let the user sign in while the purge stays scheduled,
    // so point to the Deletions tab, where restoring cancels both.
    return (
      <Link
        to="/admin"
        search={{ tab: "deletions" }}
        className="text-primary focus-visible:ring-ring inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium hover:underline focus-visible:ring-2 focus-visible:outline-none"
      >
        Manage in Deletions
        <span className="sr-only">: {user.name}</span>
      </Link>
    );
  }
  // The whole component is admin-only: a moderator reaching this panel gets a
  // read-only list, and Better Auth refuses `/admin/ban-user` for them anyway.
  // Checked here so the gate cannot be forgotten at a fourth call site.
  if (!canManageUsers) {
    return null;
  }
  if (isBanned) {
    // Not gated on `isBanInert`: unban has to work on your own row.
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="min-h-11"
        disabled={isMutating}
        onClick={() => onUnban(user.id)}
      >
        Unban
      </Button>
    );
  }
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="min-h-11"
      disabled={isBanInert}
      onClick={() => onBan(user)}
    >
      Ban
    </Button>
  );
};

/**
 * Why a control on your own row is inert.
 *
 * Better Auth rejects self-ban and self-remove outright, so the controls are
 * disabled rather than hidden: the row still has to look like every other row,
 * and silently omitting them would read as a permissions bug. Self-deletion
 * lives in Settings, where the flow can verify you and route through the
 * deletion lifecycle.
 */
const SELF_ACTION_HINT = "Manage your own account in Settings.";

/**
 * Why a control is inert because of the target's rank rather than your own.
 *
 * Worth distinguishing from the self case: an inert control on your own row is
 * expected, and one on a colleague's reads as a bug until you know the ladder.
 */
const RANK_ACTION_HINT = "You cannot act on an account above your rank.";

interface AdminUserRowProps {
  isMutating: boolean;
  /** False for a moderator, who may not manage accounts at all. */
  canManageUsers: boolean;
  /** True on the signed-in admin's own row. */
  isSelf: boolean;
  /** True when the target sits above the signed-in admin in the ladder. */
  isOutranked: boolean;
  user: AdminUser;
  onBan: (user: AdminUser) => void;
  onRemove: (user: AdminUser) => void;
  onRoleChange: (userId: string, role: Role) => void;
  onUnban: (userId: string) => void;
}

const AdminUserRow = ({
  canManageUsers,
  isMutating,
  isOutranked,
  isSelf,
  user,
  onBan,
  onRemove,
  onRoleChange,
  onUnban,
}: AdminUserRowProps) => {
  const isBanned = user.banned === true;
  const isPendingDeletion =
    isBanned && user.banReason === PENDING_DELETION_BAN_REASON;
  // Unban is the one action that leaves the admin able to act, so it stays
  // available on your own row: it is also the only way back if another admin
  // ever bans you.
  const isInert = isMutating || isSelf || isOutranked;

  return (
    <div className="border-border bg-muted/40 flex flex-wrap items-center gap-3 rounded-lg border p-3">
      <RowIcon>
        {user.image ? (
          <img
            src={user.image}
            alt=""
            className="size-8 rounded-md object-cover"
          />
        ) : (
          <IconUser size={18} stroke={1.8} />
        )}
      </RowIcon>

      <div className="min-w-0 flex-1">
        <p className="text-foreground flex flex-wrap items-center gap-2 text-sm font-medium">
          <span className="truncate">{user.name}</span>
          {user.role && isRole(user.role) && user.role !== "user" ? (
            <span className="border-border bg-background text-muted-foreground inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium tracking-wide uppercase">
              <IconShield size={10} stroke={2} />
              {ROLE_LABELS[user.role]}
            </span>
          ) : null}
          <UserStatusBadge
            isBanned={isBanned}
            isPendingDeletion={isPendingDeletion}
          />
        </p>
        <p className="text-muted-foreground truncate text-xs">
          {user.email} · Joined {formatDate(user.createdAt)}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {canManageUsers ? (
          <>
            <label className="sr-only" htmlFor={`role-${user.id}`}>
              {isSelf ? `Your own role` : `Role for ${user.name}`}
            </label>
            <Select
              value={user.role ?? "user"}
              onValueChange={(value) => {
                if (value && isRole(value)) {
                  onRoleChange(user.id, value);
                }
              }}
              disabled={isInert}
            >
              <SelectTrigger id={`role-${user.id}`} className="min-h-11 w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ALL_ROLES.map((role) => (
                  <SelectItem key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        ) : null}

        <BanAction
          isBanned={isBanned}
          isBanInert={isInert}
          canManageUsers={canManageUsers}
          isMutating={isMutating}
          isPendingDeletion={isPendingDeletion}
          user={user}
          onBan={onBan}
          onUnban={onUnban}
        />

        {canManageUsers ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="min-h-11 min-w-11"
            aria-label={`Remove ${user.name}`}
            disabled={isInert}
            onClick={() => onRemove(user)}
          >
            <IconTrash size={16} stroke={1.8} />
          </Button>
        ) : null}
      </div>

      {isSelf ? (
        <p className="text-muted-foreground w-full text-xs">
          {SELF_ACTION_HINT}
        </p>
      ) : null}
      {isOutranked ? (
        <p className="text-muted-foreground w-full text-xs">
          {RANK_ACTION_HINT}
        </p>
      ) : null}
    </div>
  );
};

/**
 * Why a removal cannot proceed, or null when it can.
 *
 * Named rather than inlined in JSX because the three cases are a ladder —
 * yourself, then someone above you, then anyone — and a nested ternary in a
 * prop buries that order under punctuation.
 */
const removalBlockReason = (
  target: AdminUser | null,
  callerId: string | null | undefined,
  callerRole: string | null | undefined
): string | null => {
  if (target === null) {
    return null;
  }
  if (target.id === callerId) {
    return SELF_ACTION_HINT;
  }
  return canActOn(callerRole, target.role) ? null : RANK_ACTION_HINT;
};

interface AdminUsersDialogsProps {
  isMutating: boolean;
  /**
   * Why the pending removal cannot go ahead, or null when it can.
   *
   * Belt-and-braces: the row's control is already disabled, so this only
   * appears if the row state drifts from the dialog state.
   */
  removeBlockReason: string | null;
  pendingBan: AdminUser | null;
  pendingRemove: AdminUser | null;
  pendingRole: { role: Role; userId: string } | null;
  onBan: (user: AdminUser) => void;
  onCloseBan: () => void;
  onCloseRemove: () => void;
  onCloseRole: () => void;
  onRemove: (user: AdminUser) => void;
  onRoleChange: (userId: string, role: Role) => void;
}

const AdminUsersDialogs = ({
  isMutating,
  removeBlockReason,
  pendingBan,
  pendingRemove,
  pendingRole,
  onBan,
  onCloseBan,
  onCloseRemove,
  onCloseRole,
  onRemove,
  onRoleChange,
}: AdminUsersDialogsProps) => (
  <>
    <ConfirmDialog
      open={pendingRole !== null}
      onOpenChange={(open) => {
        if (!open) {
          onCloseRole();
        }
      }}
      title="Change role"
      description={
        pendingRole ? `Set ${pendingRole.role} as the role for this user?` : ""
      }
      confirmLabel="Change role"
      // A routine privilege change, not a destructive one: it must not render
      // as a red primary.
      variant="default"
      pending={isMutating}
      onConfirm={() => {
        if (pendingRole) {
          onRoleChange(pendingRole.userId, pendingRole.role);
        }
      }}
    />

    <ConfirmDialog
      open={pendingBan !== null}
      onOpenChange={(open) => {
        if (!open) {
          onCloseBan();
        }
      }}
      title="Ban user"
      description={
        pendingBan
          ? `Ban ${pendingBan.name}? They will not be able to sign in.`
          : ""
      }
      confirmLabel="Ban user"
      size="md"
      pending={isMutating}
      onConfirm={() => {
        if (pendingBan) {
          onBan(pendingBan);
        }
      }}
    />

    <ConfirmDialog
      open={pendingRemove !== null}
      onOpenChange={(open) => {
        if (!open) {
          onCloseRemove();
        }
      }}
      title="Remove user"
      description={
        pendingRemove
          ? `Permanently remove ${pendingRemove.name}? This cannot be undone.`
          : ""
      }
      confirmLabel="Remove user"
      size="md"
      error={removeBlockReason}
      pending={isMutating}
      onConfirm={() => {
        if (pendingRemove) {
          onRemove(pendingRemove);
        }
      }}
    />
  </>
);

// oxlint-disable-next-line react-doctor/no-giant-component -- Splitting AdminUsers further would require major refactoring
const AdminUsers = () => {
  // Account management is admin-only, so a moderator sees the list read-only.
  // The tab itself is gated on the same capability and is not rendered for a
  // moderator at all; this is the defence for the component rendered directly.
  const { data: session } = authClient.useSession();
  const canManageUsers = can(session?.user.role, "manageUsers");
  const currentUserId = session?.user.id;

  const [state, dispatch] = useReducer(usersReducer, {
    failureId: 0,
    failure: null,
    isLoading: true,
    users: [],
  });
  const [pendingRole, setPendingRole] = useState<{
    userId: string;
    role: Role;
  } | null>(null);
  const [pendingBan, setPendingBan] = useState<AdminUser | null>(null);
  const [pendingRemove, setPendingRemove] = useState<AdminUser | null>(null);
  const [isMutating, setIsMutating] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<Role | "all">("all");

  const { failure, isLoading, users } = state;

  // Same debouncer and window as the other two search fields, so typing here
  // feels like typing there.
  const [debouncedSearch] = useDebouncedValue(searchTerm, {
    wait: SEARCH_DEBOUNCE_MS,
  });

  // The term the current failure belongs to, so "Try again" repeats the same
  // query rather than whatever the field holds when the button is clicked.
  const lastTermRef = useRef("");

  // oxlint-disable-next-line react-doctor/react-compiler-no-manual-memoization -- React Compiler is not enabled in this project; useCallback keeps loadUsers stable so the effect does not re-run on every render
  const loadUsers = useCallback(async (term: string) => {
    dispatch({ type: "LOAD_START" });

    // Search the database rather than paging a fixed list into the DOM. The
    // previous version loaded the first 100 accounts once, which quietly made
    // every user past that row unreachable — there was no way to look them up
    // at all. An empty term lists the most recent accounts.
    const query = term
      ? {
          limit: USER_SEARCH_LIMIT,
          searchField: "name" as const,
          searchOperator: "contains" as const,
          searchValue: term,
        }
      : { limit: USER_SEARCH_LIMIT };

    const { data, error: loadError } = await authClient.admin.listUsers({
      query,
    });

    if (loadError) {
      dispatch({
        error: loadError.message ?? "Could not load users.",
        type: "LOAD_ERROR",
      });
      return;
    }

    dispatch({ type: "LOAD_SUCCESS", users: data?.users ?? [] });
  }, []);

  useEffect(() => {
    if (failure) {
      toast.error(failure.message, {
        action: {
          label: "Try again",
          // Repeats the query that failed, not the one now in the field.
          onClick: () => {
            void loadUsers(lastTermRef.current);
          },
        },
      });
    }
    // `failure` is a fresh object per failure, so two identical messages are
    // two runs without a separate counter to keep in step.
  }, [failure, loadUsers]);

  useEffect(() => {
    lastTermRef.current = debouncedSearch;
    void loadUsers(debouncedSearch);
    // `lastTermRef` is a ref, not reactive state: it records the term for the
    // retry handler to read later and must not re-trigger the load itself.
  }, [debouncedSearch, loadUsers]);

  const handleRoleChange = async (userId: string, role: Role) => {
    setPendingRole(null);
    setIsMutating(true);

    const { error: roleError } = await authClient.admin.setRole({
      role,
      userId,
    });

    setIsMutating(false);

    if (roleError) {
      dispatch({
        error: roleError.message ?? "Could not change role.",
        type: "ACTION_ERROR",
      });
      return;
    }

    dispatch({ role, type: "ROLE_SUCCESS", userId });
  };

  const handleBan = async (user: AdminUser) => {
    setPendingBan(null);
    setIsMutating(true);

    const { error: banError } = await authClient.admin.banUser({
      userId: user.id,
    });

    setIsMutating(false);

    if (banError) {
      dispatch({
        error: banError.message ?? "Could not ban user.",
        type: "ACTION_ERROR",
      });
      return;
    }

    dispatch({ type: "BAN_SUCCESS", userId: user.id });
  };

  const handleUnban = async (userId: string) => {
    setIsMutating(true);

    const { error: unbanError } = await authClient.admin.unbanUser({
      userId,
    });

    setIsMutating(false);

    if (unbanError) {
      dispatch({
        error: unbanError.message ?? "Could not unban user.",
        type: "ACTION_ERROR",
      });
      return;
    }

    dispatch({ type: "UNBAN_SUCCESS", userId });
  };

  const handleRemove = async (user: AdminUser) => {
    setPendingRemove(null);
    setIsMutating(true);

    const { error: removeError } = await authClient.admin.removeUser({
      userId: user.id,
    });

    setIsMutating(false);

    if (removeError) {
      dispatch({
        error: removeError.message ?? "Could not remove user.",
        type: "ACTION_ERROR",
      });
      return;
    }

    dispatch({ type: "REMOVE_SUCCESS", userId: user.id });
  };

  /**
   * The role chips narrow what came back, rather than re-querying.
   *
   * The server already applied the search; a second round trip per chip would
   * be slower for no extra reach. The cost is that the chips filter a page of
   * results rather than the whole table, which is why the count in the header
   * describes the rows on screen.
   */
  const visibleUsers = useMemo(
    () =>
      roleFilter === "all"
        ? users
        : users.filter((user) => user.role === roleFilter),
    [roleFilter, users]
  );

  let content: ReactNode;

  if (isLoading) {
    content = (
      <div aria-busy="true" className="mt-4 grid gap-3">
        <Skeleton className="h-14" />
        <Skeleton className="h-14" />
        <Skeleton className="h-14" />
      </div>
    );
  } else if (users.length === 0) {
    content = (
      <EmptyState
        variant="inline"
        title={debouncedSearch ? "No users match" : "No users found"}
        description={
          debouncedSearch
            ? `Nothing matches “${debouncedSearch}”.`
            : "Users who sign in will appear here."
        }
        icon={<IconUsers size={20} aria-hidden="true" />}
      />
    );
  } else if (visibleUsers.length === 0) {
    content = (
      <EmptyState
        variant="inline"
        title={`No ${ROLE_LABELS[roleFilter === "all" ? "user" : roleFilter].toLowerCase()} accounts`}
        description="Clear the role filter to see the rest of these results."
        icon={<IconUsers size={20} aria-hidden="true" />}
      />
    );
  } else {
    // No virtualizer: a search returns at most 50 rows, which renders without
    // one and without the measure/ref plumbing that comes with it.
    content = (
      <ul aria-label="Users" className="mt-4 grid gap-3">
        {visibleUsers.map((user) => (
          <li key={user.id}>
            <AdminUserRow
              canManageUsers={canManageUsers}
              isMutating={isMutating}
              // Two independent reasons a row is off-limits to the caller:
              // it is their own account, or its role sits above theirs.
              isOutranked={!canActOn(session?.user.role, user.role)}
              isSelf={currentUserId !== undefined && user.id === currentUserId}
              user={user}
              onBan={setPendingBan}
              onRemove={setPendingRemove}
              onRoleChange={(userId, role) => setPendingRole({ role, userId })}
              onUnban={handleUnban}
            />
          </li>
        ))}
      </ul>
    );
  }

  const userCount = visibleUsers.length;
  const countLabel = userCount === 1 ? "account" : "accounts";

  return (
    <section aria-labelledby="admin-users-heading">
      <Card>
        <CardHeader>
          <div className="grid gap-1">
            <h2
              id="admin-users-heading"
              className="text-foreground text-lg font-semibold"
            >
              Users
            </h2>
            {/* The count describes the rows actually on screen, which is what
                the role chips below decide. */}
            <CardDescription>
              {isLoading
                ? "Manage user roles, bans, and accounts."
                : `${userCount} ${countLabel} shown. Manage roles, bans, and removals.`}
            </CardDescription>
          </div>
          <CardAction>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-11"
              disabled={isLoading}
              onClick={() => {
                void loadUsers(debouncedSearch);
              }}
            >
              Refresh
            </Button>
          </CardAction>
        </CardHeader>

        <CardContent>
          <div className="relative">
            <IconSearch
              aria-hidden="true"
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            />
            <input
              type="search"
              value={searchTerm}
              aria-label="Search users by name"
              placeholder="Search users by name…"
              className="border-border bg-background focus-visible:ring-ring focus-visible:ring-ring/50 h-11 w-full rounded-lg border pr-10 pl-9 text-sm focus-visible:ring-3 focus-visible:outline-none"
              onChange={(event) => {
                setSearchTerm(event.target.value);
              }}
            />
            {searchTerm ? (
              <button
                type="button"
                aria-label="Clear search"
                className="text-muted-foreground hover:text-foreground focus-visible:ring-ring absolute top-1/2 right-2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md focus-visible:ring-2 focus-visible:outline-none"
                onClick={() => setSearchTerm("")}
              >
                <IconX size={14} aria-hidden="true" />
              </button>
            ) : null}
          </div>

          <fieldset className="mt-3">
            <legend className="sr-only">Filter by role</legend>
            <div className="flex flex-wrap items-center gap-2">
              {(["all", ...ALL_ROLES] as const).map((role) => {
                const isActive = roleFilter === role;
                return (
                  <button
                    key={role}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => {
                      setRoleFilter(role);
                    }}
                    className={`focus-visible:ring-ring focus-visible:ring-ring/50 inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors focus-visible:ring-3 focus-visible:outline-none ${
                      isActive
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    }`}
                  >
                    {role === "all" ? "All roles" : ROLE_LABELS[role]}
                  </button>
                );
              })}
            </div>
          </fieldset>

          {content}

          <AdminUsersDialogs
            isMutating={isMutating}
            removeBlockReason={removalBlockReason(
              pendingRemove,
              currentUserId,
              session?.user.role
            )}
            pendingBan={pendingBan}
            pendingRemove={pendingRemove}
            pendingRole={pendingRole}
            onBan={handleBan}
            onCloseBan={() => setPendingBan(null)}
            onCloseRemove={() => setPendingRemove(null)}
            onCloseRole={() => setPendingRole(null)}
            onRemove={handleRemove}
            onRoleChange={handleRoleChange}
          />
        </CardContent>
      </Card>
    </section>
  );
};

export { AdminUsers };
