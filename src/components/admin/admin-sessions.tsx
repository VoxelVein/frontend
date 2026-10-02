import {
  IconClock,
  IconDeviceDesktop,
  IconDeviceMobile,
  IconSearch,
  IconUserSearch,
  IconX,
} from "@tabler/icons-react";
import { useDebouncedValue } from "@tanstack/react-pacer/debouncer";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { RowIcon } from "@/components/row-icon";
import { Button } from "@/components/ui/button";
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardAction,
  Card,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { authClient } from "@/lib/auth-client";
import { relativeTime } from "@/lib/relative-time";

const USER_SEARCH_LIMIT = 50;
const SEARCH_DEBOUNCE_MS = 300;

interface AdminUser {
  displayUsername?: string | null;
  email: string;
  id: string;
  name: string;
  username?: string | null;
}

interface AdminSession {
  createdAt: Date | string;
  expiresAt: Date | string;
  id: string;
  ipAddress?: string | null;
  token: string;
  userAgent?: string | null;
}

interface UsersState {
  error: string | null;
  isSearching: boolean;
  users: AdminUser[];
}

/**
 * Which user the failure belongs to.
 *
 * Held alongside the message so a "Try again" retries *that* user. Reading the
 * live selection at click time would reload whichever user happens to be
 * selected by then, which after a selection change is the wrong one entirely.
 */
interface SessionsState {
  error: string | null;
  /** Bumped per failure so two identical messages are still two events. */
  errorCount: number;
  failedUserId: string;
  isLoading: boolean;
  /**
   * One instant, stamped when the sessions land, so every row's expiry is
   * judged against the same moment and the render stays pure.
   */
  loadedAt: number;
  sessions: AdminSession[];
}

type UsersAction =
  | { type: "SEARCH_START" }
  | { type: "LOAD_SUCCESS"; users: AdminUser[] }
  | { type: "LOAD_ERROR"; error: string };

type SessionsAction =
  | { type: "LOAD_START" }
  | { type: "LOAD_SUCCESS"; sessions: AdminSession[] }
  | { type: "LOAD_ERROR"; error: string; userId: string }
  | { type: "REVOKE_SUCCESS"; token: string }
  | { type: "REVOKE_ERROR"; error: string; userId: string }
  | { type: "REVOKE_ALL_SUCCESS" }
  | { type: "SELECT_USER" };

const usersReducer = (state: UsersState, action: UsersAction): UsersState => {
  switch (action.type) {
    case "SEARCH_START": {
      return { ...state, isSearching: true };
    }
    case "LOAD_SUCCESS": {
      return { error: null, isSearching: false, users: action.users };
    }
    case "LOAD_ERROR": {
      return { ...state, error: action.error, isSearching: false };
    }
    default: {
      return state;
    }
  }
};

const sessionsReducer = (
  state: SessionsState,
  action: SessionsAction
): SessionsState => {
  switch (action.type) {
    case "SELECT_USER": {
      // The previous failure belongs to the previously selected user, so it is
      // cleared rather than carried over.
      return { ...state, error: null, isLoading: true };
    }
    case "LOAD_START": {
      return { ...state, error: null, isLoading: true };
    }
    case "LOAD_SUCCESS": {
      // Spread so `errorCount` survives: dropping it would make the next
      // failure compute `undefined + 1` (NaN), and React compares effect deps
      // with Object.is, which treats NaN as equal to itself.
      return {
        ...state,
        error: null,
        isLoading: false,
        loadedAt: Date.now(),
        sessions: action.sessions,
      };
    }
    case "LOAD_ERROR": {
      return {
        ...state,
        error: action.error,
        errorCount: state.errorCount + 1,
        failedUserId: action.userId,
        isLoading: false,
      };
    }
    case "REVOKE_SUCCESS": {
      return {
        ...state,
        error: null,
        sessions: state.sessions.filter(
          (session) => session.token !== action.token
        ),
      };
    }
    case "REVOKE_ERROR": {
      return {
        ...state,
        error: action.error,
        errorCount: state.errorCount + 1,
        failedUserId: action.userId,
      };
    }
    case "REVOKE_ALL_SUCCESS": {
      return { ...state, error: null, sessions: [] };
    }
    default: {
      return state;
    }
  }
};

/**
 * How a user is named in the picker.
 *
 * The handle comes first because it is what people know each other by, and the
 * email is what an admin is usually looking up.
 */
const userLabel = (user: AdminUser): string => {
  const handle = user.displayUsername ?? user.username;
  return handle
    ? `${user.name} (@${handle}) · ${user.email}`
    : `${user.name} · ${user.email}`;
};

const parseUserAgent = (userAgent: string) => {
  let browser = "Browser";
  let os = "Device";

  if (/Edg\//u.test(userAgent)) {
    browser = "Edge";
  } else if (/Chrome\//u.test(userAgent)) {
    browser = "Chrome";
  } else if (/Firefox\//u.test(userAgent)) {
    browser = "Firefox";
  } else if (/Safari\//u.test(userAgent)) {
    browser = "Safari";
  }

  if (/Windows/u.test(userAgent)) {
    os = "Windows";
  } else if (/Mac OS X/u.test(userAgent)) {
    os = "macOS";
  } else if (/Android/u.test(userAgent)) {
    os = "Android";
  } else if (/iPhone|iPad/u.test(userAgent)) {
    os = "iOS";
  }

  const isMobile = /Android|iPhone|iPad/u.test(userAgent);

  return { browser, isMobile, os };
};

const ROW_HEIGHT_ESTIMATE = 76;

const SessionRow = ({
  isRevoking,
  loadedAt,
  onRevoke,
  session,
}: {
  isRevoking: boolean;
  loadedAt: number;
  onRevoke: (token: string) => void;
  session: AdminSession;
}) => {
  const { browser, isMobile, os } = parseUserAgent(session.userAgent ?? "");
  const DeviceIcon = isMobile ? IconDeviceMobile : IconDeviceDesktop;
  const isExpired = new Date(session.expiresAt).getTime() <= loadedAt;

  return (
    <div className="border-border bg-muted/40 flex items-center gap-3 rounded-lg border p-3">
      <RowIcon>
        <DeviceIcon size={18} stroke={1.8} />
      </RowIcon>

      <div className="min-w-0 flex-1">
        <p className="text-foreground truncate text-sm font-medium">
          {browser} · {os}
        </p>
        <p className="text-muted-foreground truncate text-xs">
          {session.ipAddress ?? "Unknown IP"}
        </p>
      </div>

      {/* Expiry is what tells an admin whether a session is still live, which
          the signed-in date alone does not. */}
      <p
        className={`hidden shrink-0 text-right text-xs sm:block ${
          isExpired ? "text-destructive font-medium" : "text-muted-foreground"
        }`}
      >
        <span className="block">
          Expires {relativeTime(session.expiresAt, loadedAt)}
        </span>
        <span className="block opacity-70">
          Started {relativeTime(session.createdAt, loadedAt)}
        </span>
      </p>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="min-h-11 shrink-0"
        disabled={isRevoking}
        onClick={() => onRevoke(session.token)}
      >
        Revoke
      </Button>
    </div>
  );
};

// oxlint-disable-next-line react-doctor/no-giant-component -- Splitting AdminSessions further would require major refactoring
const AdminSessions = () => {
  const [usersState, dispatchUsers] = useReducer(usersReducer, {
    error: null,
    isSearching: false,
    users: [],
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [isRevokingAll, setIsRevokingAll] = useState(false);
  const [revokingToken, setRevokingToken] = useState<string | null>(null);
  const [state, dispatch] = useReducer(sessionsReducer, {
    error: null,
    errorCount: 0,
    failedUserId: "",
    isLoading: false,
    loadedAt: 0,
    sessions: [],
  });

  const parentRef = useRef<HTMLDivElement>(null);

  const { error, errorCount, failedUserId, isLoading, loadedAt, sessions } =
    state;

  // Same debouncer as the two search hooks elsewhere, so the feel matches and
  // a fast typist does not fire a query per keystroke.
  const [debouncedSearch] = useDebouncedValue(searchTerm, {
    wait: SEARCH_DEBOUNCE_MS,
  });

  // oxlint-disable-next-line react/incompatible-library -- useVirtualizer returns functions that cannot be memoized
  const rowVirtualizer = useVirtualizer({
    count: sessions.length,
    estimateSize: () => ROW_HEIGHT_ESTIMATE,
    gap: 12,
    getScrollElement: () => parentRef.current,
    overscan: 5,
  });

  /**
   * Looks users up server-side rather than paging a fixed list into the DOM.
   *
   * The previous version loaded the first 100 users once, which quietly made
   * every account past that unreachable — an admin investigating a report had
   * no way to reach them. `searchValue` searches the database, so the ceiling
   * no longer decides who is inspectable.
   */
  const loadUsers = useCallback(async (term: string) => {
    dispatchUsers({ type: "SEARCH_START" });

    // Search the database rather than paging a fixed list into the DOM, so the
    // result ceiling does not decide who is inspectable. An empty term lists
    // the most recent accounts, which is the useful default before anything has
    // been typed.
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
      dispatchUsers({
        error: loadError.message ?? "Could not load users.",
        type: "LOAD_ERROR",
      });
      return;
    }

    dispatchUsers({ type: "LOAD_SUCCESS", users: data?.users ?? [] });
  }, []);

  useEffect(() => {
    loadUsers(debouncedSearch);
  }, [debouncedSearch, loadUsers]);

  // oxlint-disable-next-line react-doctor/react-compiler-no-manual-memoization -- React Compiler is not enabled in this project; useCallback keeps loadSessions stable so the effect does not re-run on every render
  const loadSessions = useCallback(async (userId: string) => {
    if (!userId) {
      return;
    }

    dispatch({ type: "LOAD_START" });

    const { data, error: loadError } = await authClient.admin.listUserSessions({
      userId,
    });

    if (loadError) {
      dispatch({
        error: loadError.message ?? "Could not load sessions.",
        type: "LOAD_ERROR",
        userId,
      });
      return;
    }

    dispatch({ sessions: data?.sessions ?? [], type: "LOAD_SUCCESS" });
  }, []);

  useEffect(() => {
    if (error) {
      toast.error(error, {
        action: {
          label: "Try again",
          // Retries the user the failure belongs to, not whichever is selected
          // when the button is clicked.
          onClick: () => loadSessions(failedUserId),
        },
      });
    }
    // errorCount is in the deps so a repeat failure with the same message is
    // still a separate event.
  }, [error, errorCount, failedUserId, loadSessions]);

  useEffect(() => {
    if (selectedUserId) {
      loadSessions(selectedUserId);
    }
  }, [loadSessions, selectedUserId]);

  const handleRevoke = async (token: string) => {
    setRevokingToken(token);
    const { error: revokeError } = await authClient.admin.revokeUserSession({
      sessionToken: token,
    });
    setRevokingToken(null);

    if (revokeError) {
      dispatch({
        error: revokeError.message ?? "Could not revoke session.",
        type: "REVOKE_ERROR",
        userId: selectedUserId,
      });
      return;
    }

    dispatch({ token, type: "REVOKE_SUCCESS" });
    toast.success("Session revoked.");
  };

  /**
   * Kills every session for the selected user.
   *
   * The case that matters is a compromised account: an admin investigating one
   * wants the attacker out now, not one row at a time. Uses the same endpoint
   * the sign-out-everywhere button uses.
   */
  const handleRevokeAll = async () => {
    setIsRevokingAll(true);
    const { error: revokeError } = await authClient.admin.revokeUserSessions({
      userId: selectedUserId,
    });
    setIsRevokingAll(false);

    if (revokeError) {
      dispatch({
        error: revokeError.message ?? "Could not revoke sessions.",
        type: "REVOKE_ERROR",
        userId: selectedUserId,
      });
      return;
    }

    dispatch({ type: "REVOKE_ALL_SUCCESS" });
    toast.success("All sessions revoked.");
  };

  const selectedUser = usersState.users.find(
    (user) => user.id === selectedUserId
  );

  const sessionCount = sessions.length;
  const countLabel = sessionCount === 1 ? "session" : "sessions";

  let content: ReactNode;

  if (usersState.error) {
    content = (
      <ErrorState
        message={usersState.error}
        onRetry={() => loadUsers(debouncedSearch)}
      />
    );
  } else if (!selectedUserId) {
    content = (
      <EmptyState
        variant="inline"
        title="Search for a user"
        description="Start typing a name to find the account, then pick them to inspect their sessions."
        icon={<IconUserSearch size={20} aria-hidden="true" />}
      />
    );
  } else if (isLoading) {
    content = (
      <div aria-busy="true" className="mt-4 grid gap-3">
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
      </div>
    );
  } else if (sessionCount === 0) {
    content = (
      <EmptyState
        variant="inline"
        title="No active sessions"
        description="This user has no active sessions right now."
        icon={<IconDeviceDesktop size={20} aria-hidden="true" />}
      />
    );
  } else {
    content = (
      <div ref={parentRef} className="mt-4 max-h-[32rem] overflow-auto">
        <ul
          aria-label="Sessions"
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
              <SessionRow
                isRevoking={revokingToken === sessions[virtualRow.index].token}
                loadedAt={loadedAt}
                onRevoke={handleRevoke}
                session={sessions[virtualRow.index]}
              />
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <section aria-labelledby="admin-sessions-heading">
      <Card>
        <CardHeader>
          <div className="grid gap-1">
            <h2
              id="admin-sessions-heading"
              className="text-foreground text-lg font-semibold"
            >
              Sessions
            </h2>
            <CardDescription>
              {selectedUser
                ? `${userLabel(selectedUser)} — ${sessionCount} active ${countLabel}.`
                : "Search for a user, then review or revoke their sessions."}
            </CardDescription>
          </div>

          {sessionCount > 1 ? (
            <CardAction>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-11"
                disabled={isRevokingAll || Boolean(revokingToken)}
                onClick={() => {
                  void handleRevokeAll();
                }}
              >
                Revoke all
              </Button>
            </CardAction>
          ) : null}
        </CardHeader>

        <CardContent>
          <div className="relative mt-2">
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

          {usersState.isSearching && usersState.users.length === 0 ? (
            <div aria-busy="true" className="mt-3 grid gap-2">
              <Skeleton className="h-11" />
              <Skeleton className="h-11" />
            </div>
          ) : null}

          {!usersState.isSearching &&
          debouncedSearch &&
          usersState.users.length === 0 ? (
            <p className="text-muted-foreground mt-3 text-sm">
              No users match “{debouncedSearch}”.
            </p>
          ) : null}

          {usersState.users.length > 0 ? (
            <ul aria-label="Matching users" className="mt-3 grid gap-1">
              {usersState.users.map((user) => {
                const isSelected = user.id === selectedUserId;
                return (
                  <li key={user.id}>
                    <button
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => {
                        dispatch({ type: "SELECT_USER" });
                        setSelectedUserId(user.id);
                      }}
                      className={`focus-visible:ring-ring flex min-h-11 w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none ${
                        isSelected
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border bg-card hover:bg-muted/50 text-muted-foreground"
                      }`}
                    >
                      <IconUserSearch
                        aria-hidden="true"
                        className="shrink-0"
                        size={16}
                      />
                      <span className="truncate">{userLabel(user)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}

          {selectedUserId ? (
            <div className="border-border mt-6 border-t pt-2">
              <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
                <IconClock aria-hidden="true" size={13} />
                Expiry is when the session stops working on its own. Revoking
                ends it immediately.
              </div>
              {content}
            </div>
          ) : (
            <div className="mt-4">{content}</div>
          )}
        </CardContent>
      </Card>
    </section>
  );
};

export { AdminSessions };
