import {
  IconDeviceDesktop,
  IconDeviceMobile,
  IconUserSearch,
} from "@tabler/icons-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import {
  CardContent,
  CardDescription,
  CardHeader,
  Card,
} from "@/components/ui/card";
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
  email: string;
  id: string;
  name: string;
}

interface AdminSession {
  createdAt: Date | string;
  expiresAt: Date | string;
  id: string;
  ipAddress?: string | null;
  token: string;
  userAgent?: string | null;
}

interface SessionsState {
  error: string | null;
  /**
   * Bumped on every failure. The toast keys on this rather than on `error`, so
   * two failures reporting the same message are still two separate events and
   * the admin hears about both.
   */
  errorCount: number;
  isLoading: boolean;
  sessions: AdminSession[];
}

interface UsersState {
  error: string | null;
  users: AdminUser[];
}

type SessionsAction =
  | { type: "LOAD_START" }
  | { type: "LOAD_SUCCESS"; sessions: AdminSession[] }
  | { type: "LOAD_ERROR"; error: string }
  | { type: "REVOKE_SUCCESS"; token: string }
  | { type: "REVOKE_ERROR"; error: string }
  | { type: "SELECT_USER" };

type UsersAction =
  | { type: "LOAD_SUCCESS"; users: AdminUser[] }
  | { type: "LOAD_ERROR"; error: string };

const usersReducer = (state: UsersState, action: UsersAction): UsersState => {
  switch (action.type) {
    case "LOAD_SUCCESS": {
      return { error: null, users: action.users };
    }
    case "LOAD_ERROR": {
      return { ...state, error: action.error };
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
      // The previous failure belongs to the user that was selected before, so
      // carrying it over would re-raise it for the new selection and point its
      // retry at the wrong user. isLoading goes up immediately so the skeleton
      // replaces the old user's rows instead of flashing an empty state before
      // LOAD_START lands.
      return { ...state, error: null, isLoading: true };
    }
    case "LOAD_START": {
      return { ...state, error: null, isLoading: true };
    }
    case "LOAD_SUCCESS": {
      // Spread so errorCount survives: dropping it would make the next failure
      // compute `undefined + 1` (NaN), and React compares effect deps with
      // Object.is, which treats NaN as equal to itself — the effect would then
      // never re-run for two failures in a row.
      return {
        ...state,
        error: null,
        isLoading: false,
        sessions: action.sessions,
      };
    }
    case "LOAD_ERROR": {
      return {
        ...state,
        error: action.error,
        errorCount: state.errorCount + 1,
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

const formatDate = (value: Date | string) =>
  dateFormatter.format(new Date(value));

const ROW_HEIGHT_ESTIMATE = 80;

// oxlint-disable-next-line react-doctor/no-giant-component -- Splitting AdminSessions further would require major refactoring
const AdminSessions = () => {
  const [usersState, dispatchUsers] = useReducer(usersReducer, {
    error: null,
    users: [],
  });
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [state, dispatch] = useReducer(sessionsReducer, {
    error: null,
    errorCount: 0,
    isLoading: false,
    sessions: [],
  });

  const parentRef = useRef<HTMLDivElement>(null);
  const selectedUserIdRef = useRef(selectedUserId);

  const { error, errorCount, isLoading, sessions } = state;

  // oxlint-disable-next-line react/incompatible-library -- useVirtualizer returns functions that cannot be memoized
  const rowVirtualizer = useVirtualizer({
    count: sessions.length,
    estimateSize: () => ROW_HEIGHT_ESTIMATE,
    gap: 12,
    getScrollElement: () => parentRef.current,
    overscan: 5,
  });

  // oxlint-disable-next-line react-doctor/react-compiler-no-manual-memoization -- React Compiler is not enabled in this project; useCallback keeps loadUsers stable so the effect does not re-run on every render
  const loadUsers = useCallback(async () => {
    const { data, error: loadError } = await authClient.admin.listUsers({
      query: { limit: 100 },
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
    loadUsers();
  }, [loadUsers]);

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
      });
      return;
    }

    dispatch({ sessions: data?.sessions ?? [], type: "LOAD_SUCCESS" });
  }, []);

  useEffect(() => {
    selectedUserIdRef.current = selectedUserId;
  }, [selectedUserId]);

  useEffect(() => {
    if (error) {
      toast.error(error, {
        action: {
          label: "Try again",
          // Read through a ref so this effect depends on the error alone.
          // Depending on the selection would re-run it on every user change and
          // bind the retry to whichever user happens to be selected when the
          // toast is clicked, rather than the one that failed.
          onClick: () => loadSessions(selectedUserIdRef.current),
        },
      });
    }
    // errorCount is in the deps so the effect re-runs for a repeat failure that
    // carries the same message; without it the second identical failure would
    // leave `error` unchanged and be announced to nobody.
  }, [error, errorCount, loadSessions]);

  useEffect(() => {
    if (selectedUserId) {
      loadSessions(selectedUserId);
    }
  }, [loadSessions, selectedUserId]);

  const handleRevoke = async (token: string) => {
    const { error: revokeError } = await authClient.admin.revokeUserSession({
      sessionToken: token,
    });

    if (revokeError) {
      dispatch({
        error: revokeError.message ?? "Could not revoke session.",
        type: "REVOKE_ERROR",
      });
      return;
    }

    dispatch({ token, type: "REVOKE_SUCCESS" });
  };

  let content: ReactNode;

  if (!selectedUserId) {
    content = (
      <EmptyState
        variant="inline"
        title="Select a user"
        description="Choose a user to view their active sessions."
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
  } else if (sessions.length === 0) {
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
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const session = sessions[virtualRow.index];
            const { browser, isMobile, os } = parseUserAgent(
              session.userAgent ?? ""
            );
            const DeviceIcon = isMobile ? IconDeviceMobile : IconDeviceDesktop;

            return (
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
                <div className="border-border bg-muted/40 flex items-center gap-3 rounded-lg border p-3">
                  <span
                    aria-hidden="true"
                    className="border-border bg-background text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-lg border"
                  >
                    <DeviceIcon size={18} stroke={1.8} />
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="text-foreground truncate text-sm font-medium">
                      {browser} · {os}
                    </p>
                    <p className="text-muted-foreground truncate text-xs">
                      {session.ipAddress ?? "Unknown IP"} · Signed in{" "}
                      {formatDate(session.createdAt)}
                    </p>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="min-h-11 shrink-0"
                    onClick={() => handleRevoke(session.token)}
                  >
                    Revoke
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  return (
    <section aria-labelledby="admin-sessions-heading">
      <Card>
        <CardHeader>
          <h2
            id="admin-sessions-heading"
            className="text-foreground text-lg font-semibold"
          >
            Sessions
          </h2>
          <CardDescription>
            View and revoke sessions for any user.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="mt-4">
            <label
              htmlFor="admin-session-user"
              className="text-foreground mb-1.5 block text-sm font-medium"
            >
              User
            </label>
            <Select
              value={selectedUserId}
              onValueChange={(value) => {
                if (value) {
                  dispatch({ type: "SELECT_USER" });
                  setSelectedUserId(value);
                }
              }}
            >
              <SelectTrigger
                id="admin-session-user"
                className="min-h-11 w-full max-w-sm"
              >
                <SelectValue placeholder="Select a user…" />
              </SelectTrigger>
              <SelectContent>
                {usersState.users.length === 0 ? (
                  <SelectItem value="" disabled>
                    Loading users…
                  </SelectItem>
                ) : (
                  usersState.users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name} ({user.email})
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {content}
        </CardContent>
      </Card>
    </section>
  );
};

export { AdminSessions };
