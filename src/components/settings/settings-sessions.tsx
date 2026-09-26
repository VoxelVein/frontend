import { IconDeviceDesktop, IconDeviceMobile } from "@tabler/icons-react";
import { useCallback, useEffect, useReducer, useState } from "react";
import type { ReactNode } from "react";

import { EmptyState } from "@/components/empty-state";
import { AlertDescription, Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  Card,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth-client";

interface SessionItem {
  createdAt: Date | string;
  expiresAt: Date | string;
  id: string;
  ipAddress?: string | null;
  token: string;
  userAgent?: string | null;
}

interface SettingsSessionsProps {
  currentSessionToken?: string | null;
}

interface SessionsState {
  error: string | null;
  isLoading: boolean;
  sessions: SessionItem[];
}

type SessionsAction =
  | { type: "LOAD_START" }
  | { type: "LOAD_SUCCESS"; sessions: SessionItem[] }
  | { type: "LOAD_ERROR"; error: string }
  | { type: "REVOKE_SUCCESS"; token: string }
  | { type: "REVOKE_OTHERS_SUCCESS"; token: string }
  | { type: "REVOKE_ERROR"; error: string };

const sessionsReducer = (
  state: SessionsState,
  action: SessionsAction
): SessionsState => {
  switch (action.type) {
    case "LOAD_START": {
      return { ...state, error: null, isLoading: true };
    }
    case "LOAD_SUCCESS": {
      return { error: null, isLoading: false, sessions: action.sessions };
    }
    case "LOAD_ERROR": {
      return { ...state, error: action.error, isLoading: false };
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
    case "REVOKE_OTHERS_SUCCESS": {
      return {
        ...state,
        error: null,
        sessions: state.sessions.filter(
          (session) => session.token === action.token
        ),
      };
    }
    case "REVOKE_ERROR": {
      return { ...state, error: action.error };
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

const SettingsSessions = ({ currentSessionToken }: SettingsSessionsProps) => {
  const [state, dispatch] = useReducer(sessionsReducer, {
    error: null,
    isLoading: true,
    sessions: [],
  });
  const [isRevokingOther, setIsRevokingOther] = useState(false);

  // oxlint-disable-next-line react-doctor/react-compiler-no-manual-memoization -- React Compiler is not enabled in this project; useCallback keeps loadSessions stable so the effect does not re-run on every render
  const loadSessions = useCallback(async () => {
    dispatch({ type: "LOAD_START" });

    const { data, error: loadError } = await authClient.listSessions();

    if (loadError) {
      dispatch({
        error: loadError.message ?? "Could not load sessions.",
        type: "LOAD_ERROR",
      });
      return;
    }

    dispatch({ sessions: data ?? [], type: "LOAD_SUCCESS" });
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const handleRevoke = async (token: string) => {
    const { error: revokeError } = await authClient.revokeSession({ token });

    if (revokeError) {
      dispatch({
        error: revokeError.message ?? "Could not revoke session.",
        type: "REVOKE_ERROR",
      });
      return;
    }

    dispatch({ token, type: "REVOKE_SUCCESS" });
  };

  const handleRevokeOthers = async () => {
    setIsRevokingOther(true);
    const { error: revokeError } = await authClient.revokeOtherSessions();
    setIsRevokingOther(false);

    if (revokeError) {
      dispatch({
        error: revokeError.message ?? "Could not revoke other sessions.",
        type: "REVOKE_ERROR",
      });
      return;
    }

    dispatch({
      token: currentSessionToken ?? "",
      type: "REVOKE_OTHERS_SUCCESS",
    });
  };

  const { error, isLoading, sessions } = state;

  let content: ReactNode;

  if (isLoading) {
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
        description="Devices signed in to your account will appear here."
        icon={<IconDeviceDesktop size={20} aria-hidden="true" />}
      />
    );
  } else {
    content = (
      <ul className="mt-4 grid gap-3">
        {sessions.map((session) => {
          const { browser, isMobile, os } = parseUserAgent(
            session.userAgent ?? ""
          );
          const isCurrent = session.token === currentSessionToken;
          const DeviceIcon = isMobile ? IconDeviceMobile : IconDeviceDesktop;

          return (
            <li
              key={session.id}
              className="border-border bg-muted/40 flex items-center gap-3 rounded-lg border p-3"
            >
              <span
                aria-hidden="true"
                className="border-border bg-background text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-lg border"
              >
                <DeviceIcon size={18} stroke={1.8} />
              </span>

              <div className="min-w-0 flex-1">
                <p className="text-foreground flex items-center gap-2 text-sm font-medium">
                  <span className="truncate">
                    {browser} · {os}
                  </span>
                  {isCurrent ? (
                    <span className="border-border bg-background text-muted-foreground rounded-full border px-2 py-0.5 text-xs font-medium tracking-wide uppercase">
                      Current
                    </span>
                  ) : null}
                </p>
                <p className="text-muted-foreground truncate text-xs">
                  {session.ipAddress ?? "Unknown IP"} · Signed in{" "}
                  {formatDate(session.createdAt)}
                </p>
              </div>

              {isCurrent ? null : (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="min-h-11 shrink-0"
                  onClick={() => handleRevoke(session.token)}
                >
                  Revoke
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <section aria-labelledby="settings-sessions-heading">
      <Card>
        <CardHeader>
          <h2
            id="settings-sessions-heading"
            className="text-foreground text-lg font-semibold"
          >
            Sessions
          </h2>
          <CardDescription>Devices signed in to your account.</CardDescription>
          <CardAction>
            {sessions.length > 1 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-11"
                disabled={isRevokingOther}
                onClick={handleRevokeOthers}
              >
                {isRevokingOther ? (
                  <>
                    <Spinner className="mr-1" />
                    Signing out…
                  </>
                ) : (
                  "Sign Out Other Sessions"
                )}
              </Button>
            ) : null}
          </CardAction>
        </CardHeader>

        <CardContent>
          {error ? (
            <Alert variant="destructive" className="mt-4">
              <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
                <span>{error}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="min-h-11"
                  onClick={() => loadSessions()}
                >
                  Try again
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}

          {content}
        </CardContent>
      </Card>
    </section>
  );
};

export { SettingsSessions };
