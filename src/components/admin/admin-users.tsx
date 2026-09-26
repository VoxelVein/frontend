import {
  IconBan,
  IconClockX,
  IconShield,
  IconTrash,
  IconUser,
  IconUsers,
} from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/empty-state";
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
  error: string | null;
  /**
   * Bumped on every failure. The toast keys on this rather than on `error`, so
   * two failures reporting the same message are still two separate events and
   * the admin hears about both.
   */
  errorCount: number;
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
      return { ...state, error: null, isLoading: true };
    }
    case "LOAD_SUCCESS": {
      // Spread so errorCount survives: dropping it would make the next failure
      // compute `undefined + 1` (NaN), and React compares effect deps with
      // Object.is, which treats NaN as equal to itself — the effect would then
      // never re-run for two failures in a row.
      return { ...state, error: null, isLoading: false, users: action.users };
    }
    case "LOAD_ERROR": {
      return {
        ...state,
        error: action.error,
        errorCount: state.errorCount + 1,
        isLoading: false,
      };
    }
    case "ROLE_SUCCESS": {
      return {
        ...state,
        error: null,
        users: state.users.map((user) =>
          user.id === action.userId ? { ...user, role: action.role } : user
        ),
      };
    }
    case "BAN_SUCCESS": {
      return {
        ...state,
        error: null,
        users: state.users.map((user) =>
          user.id === action.userId ? { ...user, banned: true } : user
        ),
      };
    }
    case "UNBAN_SUCCESS": {
      return {
        ...state,
        error: null,
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
        error: null,
        users: state.users.filter((user) => user.id !== action.userId),
      };
    }
    case "ACTION_ERROR": {
      return {
        ...state,
        error: action.error,
        errorCount: state.errorCount + 1,
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

const ROW_HEIGHT_ESTIMATE = 80;

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
  isMutating: boolean;
  isPendingDeletion: boolean;
  user: AdminUser;
  onBan: (user: AdminUser) => void;
  onUnban: (userId: string) => void;
}

const BanAction = ({
  isBanned,
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
  if (isBanned) {
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
      disabled={isMutating}
      onClick={() => onBan(user)}
    >
      Ban
    </Button>
  );
};

interface AdminUserRowProps {
  isMutating: boolean;
  user: AdminUser;
  onBan: (user: AdminUser) => void;
  onRemove: (user: AdminUser) => void;
  onRoleChange: (userId: string, role: "admin" | "user") => void;
  onUnban: (userId: string) => void;
}

const AdminUserRow = ({
  isMutating,
  user,
  onBan,
  onRemove,
  onRoleChange,
  onUnban,
}: AdminUserRowProps) => {
  const isBanned = user.banned === true;
  const isPendingDeletion =
    isBanned && user.banReason === PENDING_DELETION_BAN_REASON;

  return (
    <div className="border-border bg-muted/40 flex flex-wrap items-center gap-3 rounded-lg border p-3">
      <span
        aria-hidden="true"
        className="border-border bg-background text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-lg border"
      >
        {user.image ? (
          <img
            src={user.image}
            alt=""
            className="size-8 rounded-md object-cover"
          />
        ) : (
          <IconUser size={18} stroke={1.8} />
        )}
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-foreground flex flex-wrap items-center gap-2 text-sm font-medium">
          <span className="truncate">{user.name}</span>
          {user.role === "admin" ? (
            <span className="border-border bg-background text-muted-foreground inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium tracking-wide uppercase">
              <IconShield size={10} stroke={2} />
              Admin
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
        <label className="sr-only" htmlFor={`role-${user.id}`}>
          Role for {user.name}
        </label>
        <Select
          value={user.role ?? "user"}
          onValueChange={(value) =>
            // SAFETY: The select only renders "user" and "admin" options, so the value is always one of these two literals.
            onRoleChange(user.id, value as "admin" | "user")
          }
          disabled={isMutating}
        >
          <SelectTrigger id={`role-${user.id}`} className="min-h-11 w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="user">User</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
          </SelectContent>
        </Select>

        <BanAction
          isBanned={isBanned}
          isMutating={isMutating}
          isPendingDeletion={isPendingDeletion}
          user={user}
          onBan={onBan}
          onUnban={onUnban}
        />

        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="min-h-11 min-w-11"
          aria-label={`Remove ${user.name}`}
          disabled={isMutating}
          onClick={() => onRemove(user)}
        >
          <IconTrash size={16} stroke={1.8} />
        </Button>
      </div>
    </div>
  );
};

interface AdminUsersDialogsProps {
  isMutating: boolean;
  pendingBan: AdminUser | null;
  pendingRemove: AdminUser | null;
  pendingRole: { role: "admin" | "user"; userId: string } | null;
  onBan: (user: AdminUser) => void;
  onCloseBan: () => void;
  onCloseRemove: () => void;
  onCloseRole: () => void;
  onRemove: (user: AdminUser) => void;
  onRoleChange: (userId: string, role: "admin" | "user") => void;
}

const AdminUsersDialogs = ({
  isMutating,
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
  const [state, dispatch] = useReducer(usersReducer, {
    error: null,
    errorCount: 0,
    isLoading: true,
    users: [],
  });
  const [pendingRole, setPendingRole] = useState<{
    userId: string;
    role: "admin" | "user";
  } | null>(null);
  const [pendingBan, setPendingBan] = useState<AdminUser | null>(null);
  const [pendingRemove, setPendingRemove] = useState<AdminUser | null>(null);
  const [isMutating, setIsMutating] = useState(false);

  const parentRef = useRef<HTMLDivElement>(null);

  const { error, errorCount, isLoading, users } = state;

  // oxlint-disable-next-line react/incompatible-library -- useVirtualizer returns functions that cannot be memoized
  const rowVirtualizer = useVirtualizer({
    count: users.length,
    estimateSize: () => ROW_HEIGHT_ESTIMATE,
    gap: 12,
    getScrollElement: () => parentRef.current,
    overscan: 5,
  });

  // oxlint-disable-next-line react-doctor/react-compiler-no-manual-memoization -- React Compiler is not enabled in this project; useCallback keeps loadUsers stable so the effect does not re-run on every render
  const loadUsers = useCallback(async () => {
    dispatch({ type: "LOAD_START" });

    const { data, error: loadError } = await authClient.admin.listUsers({
      query: { limit: 100 },
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
    if (error) {
      toast.error(error, {
        action: {
          label: "Try again",
          onClick: () => loadUsers(),
        },
      });
    }
    // errorCount is in the deps so the effect re-runs for a repeat failure that
    // carries the same message; without it the second identical failure would
    // leave `error` unchanged and be announced to nobody.
  }, [error, errorCount, loadUsers]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleRoleChange = async (userId: string, role: "admin" | "user") => {
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
        title="No users found"
        description="Users who sign in will appear here."
        icon={<IconUsers size={20} aria-hidden="true" />}
      />
    );
  } else {
    content = (
      <div ref={parentRef} className="mt-4 max-h-[32rem] overflow-auto">
        <ul
          aria-label="Users"
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            position: "relative",
            width: "100%",
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => (
            <li
              key={virtualRow.key}
              data-index={virtualRow.index}
              ref={(el) => {
                rowVirtualizer.measureElement(el);
              }}
              style={{
                left: 0,
                position: "absolute",
                top: 0,
                transform: `translateY(${virtualRow.start}px)`,
                width: "100%",
              }}
            >
              <AdminUserRow
                isMutating={isMutating}
                user={users[virtualRow.index]}
                onBan={setPendingBan}
                onRemove={setPendingRemove}
                onRoleChange={(userId, role) =>
                  setPendingRole({ role, userId })
                }
                onUnban={handleUnban}
              />
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <section aria-labelledby="admin-users-heading">
      <Card>
        <CardHeader>
          <h2
            id="admin-users-heading"
            className="text-foreground text-lg font-semibold"
          >
            Users
          </h2>
          <CardDescription>
            Manage user roles, bans, and accounts.
          </CardDescription>
          <CardAction>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-11"
              disabled={isLoading}
              onClick={() => loadUsers()}
            >
              Refresh
            </Button>
          </CardAction>
        </CardHeader>

        <CardContent>
          {content}

          <AdminUsersDialogs
            isMutating={isMutating}
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
