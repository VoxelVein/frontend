import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AdminSessions } from "@/components/admin/admin-sessions";

interface ToastOptions {
  action: { label: string; onClick: () => void };
}

const {
  listUserSessionsMock,
  listUsersMock,
  revokeUserSessionMock,
  toastErrorMock,
} = vi.hoisted(() => ({
  listUserSessionsMock: vi.fn<(opts: { userId: string }) => Promise<object>>(),
  listUsersMock: vi.fn<() => Promise<object>>(),
  revokeUserSessionMock:
    vi.fn<(opts: { sessionToken: string }) => Promise<object>>(),
  // Typed so `mock.calls` is readable without a cast: the retry action is the
  // only thing this suite reaches for, and the component always passes it.
  toastErrorMock: vi.fn<(message: string, options: ToastOptions) => void>(),
}));

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- The component talks to Better Auth over the network; string paths avoid strict factory type-checking against the client types
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    admin: {
      listUserSessions: listUserSessionsMock,
      listUsers: listUsersMock,
      revokeUserSession: revokeUserSessionMock,
    },
  },
}));

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- Toasts render into a portal outside the component tree; a stub keeps the assertion on the call the component made
vi.mock("sonner", () => ({
  toast: { error: toastErrorMock },
}));

// The row virtualizer measures a real scroll container, which jsdom reports as
// 0x0, so it windowizes everything out of view. Render every row instead: this
// suite asserts on error reporting, not on windowing.
// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- jsdom cannot exercise a measurement-based virtualizer, so it is replaced with an equivalent that yields every row
vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getTotalSize: () => count * 80,
    getVirtualItems: () =>
      Array.from({ length: count }, (_, index) => ({
        index,
        key: index,
        start: index * 80,
      })),
    measureElement: () => {},
  }),
}));

const ALICE = { email: "alice@example.com", id: "user-alice", name: "Alice" };
const BOB = { email: "bob@example.com", id: "user-bob", name: "Bob" };

const FAILURE_MESSAGE = "Could not load sessions.";

/** The sessions one user has, shaped as Better Auth returns them. */
const sessionsFor = (token: string) => ({
  data: {
    sessions: [
      {
        createdAt: "2026-01-01T00:00:00.000Z",
        expiresAt: "2026-02-01T00:00:00.000Z",
        id: `session-${token}`,
        ipAddress: "203.0.113.1",
        token,
        userAgent: "Mozilla/5.0 (Macintosh)",
      },
    ],
  },
  error: null,
});

const failure = {
  data: null,
  error: { message: FAILURE_MESSAGE },
};

/**
 * Drains pending work before asserting. Every async path in the component
 * awaits the auth call before dispatching, so state lands some microtasks after
 * the event that caused it. Ticking the microtask queue inside act() keeps
 * those commits inside the act scope; without this React reports updates that
 * escaped the test.
 */
const settle = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
};

// The picker is a search field plus a result list of buttons, not a Select, so
// a user is chosen by clicking their row.
const selectUser = async (name: string) => {
  // The user list is fetched on mount, so it has to commit before a row exists.
  await settle();
  const option = await screen.findByRole("button", {
    name: new RegExp(name, "u"),
  });
  fireEvent.click(option);
  await settle();
};

/**
 * Revoke is an async handler: it awaits the auth call before dispatching, so
 * the click alone does not commit the reducer.
 */
const clickRevoke = async () => {
  fireEvent.click(screen.getByRole("button", { name: "Revoke" }));
  await settle();
};

describe(AdminSessions, () => {
  beforeEach(() => {
    listUsersMock.mockReset().mockResolvedValue({
      data: { users: [ALICE, BOB] },
      error: null,
    });
    listUserSessionsMock.mockReset().mockResolvedValue(sessionsFor("a"));
    revokeUserSessionMock.mockReset().mockResolvedValue({
      data: null,
      error: null,
    });
    toastErrorMock.mockReset();
  });

  it("names the selected user in the picker instead of their id", async () => {
    render(<AdminSessions />);

    await selectUser("Alice");

    // A user id is a UUID, so the panel must name the person rather than show
    // a raw value anywhere.
    const panel = screen.getByRole("region", { name: "Sessions" });
    expect(panel).toHaveTextContent("Alice");
    expect(panel).toHaveTextContent("alice@example.com");
    expect(panel).not.toHaveTextContent(ALICE.id);
  });

  it("shows the handle in the picker when the user has one", async () => {
    listUsersMock.mockResolvedValue({
      data: {
        users: [
          { ...ALICE, displayUsername: "AliceC", username: "alicec" },
          BOB,
        ],
      },
      error: null,
    });
    render(<AdminSessions />);

    await selectUser("AliceC");

    expect(screen.getByRole("region", { name: "Sessions" })).toHaveTextContent(
      "@AliceC"
    );
  });

  it("falls back to the plain username when no display name was chosen", async () => {
    listUsersMock.mockResolvedValue({
      data: {
        users: [{ ...ALICE, displayUsername: null, username: "alicec" }, BOB],
      },
      error: null,
    });
    render(<AdminSessions />);

    await selectUser("alicec");

    expect(screen.getByRole("region", { name: "Sessions" })).toHaveTextContent(
      "@alicec"
    );
  });

  it("omits the handle for an account that never chose one", async () => {
    listUsersMock.mockResolvedValue({
      data: {
        users: [{ ...ALICE, displayUsername: null, username: null }, BOB],
      },
      error: null,
    });
    render(<AdminSessions />);

    await selectUser("Alice");

    const panel = screen.getByRole("region", { name: "Sessions" });
    expect(panel).toHaveTextContent("alice@example.com");
    // The handle marker is "(@", because the email's own "@" would match otherwise.
    expect(panel).not.toHaveTextContent("(@");
  });

  it("searches users in the database rather than paging a fixed list", async () => {
    // The previous version loaded the first 100 accounts once, which made
    // every user past that unreachable: there was no way to look them up at
    // all. The query must carry the typed term so the server does the search.
    listUsersMock.mockResolvedValue({
      data: { total: 1, users: [ALICE] },
      error: null,
    });
    render(<AdminSessions />);
    await settle();

    fireEvent.change(screen.getByLabelText("Search users by name"), {
      target: { value: "Ali" },
    });

    // The picker debounces at 300ms like the other search fields, so this
    // waits on real time rather than `settle`, which only flushes microtasks.
    await waitFor(() => {
      expect(listUsersMock).toHaveBeenCalledWith({
        query: {
          limit: 50,
          searchField: "name",
          searchOperator: "contains",
          searchValue: "Ali",
        },
      });
    });
  });

  it("reports a failed session load once", async () => {
    listUserSessionsMock.mockResolvedValue(failure);
    render(<AdminSessions />);

    await selectUser("Alice");

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledOnce();
    });
    expect(toastErrorMock).toHaveBeenCalledWith(
      FAILURE_MESSAGE,
      expect.anything()
    );
  });

  it("does not re-raise the previous failure when another user is selected", async () => {
    listUserSessionsMock.mockResolvedValue(failure);
    render(<AdminSessions />);

    await selectUser("Alice");
    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledOnce();
    });

    // The second load succeeds, so the earlier failure belongs to a selection
    // that is no longer current and must not be announced a second time.
    listUserSessionsMock.mockResolvedValue(sessionsFor("b"));
    await selectUser("Bob");

    await waitFor(() => {
      expect(listUserSessionsMock).toHaveBeenCalledWith({ userId: BOB.id });
    });
    expect(toastErrorMock).toHaveBeenCalledOnce();
  });

  it("retries the session load for the user that failed", async () => {
    listUserSessionsMock.mockResolvedValue(failure);
    render(<AdminSessions />);

    await selectUser("Alice");
    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledOnce();
    });

    // The retry action is bound to the user that failed, not to whichever user
    // is selected at the moment the toast is acted on.
    listUserSessionsMock.mockResolvedValue(sessionsFor("b"));
    // The retry dispatches LOAD_START synchronously, before its first await, so
    // the call itself has to happen inside act().
    act(() => {
      toastErrorMock.mock.calls[0]?.[1].action.onClick();
    });
    await settle();

    await waitFor(() => {
      expect(listUserSessionsMock).toHaveBeenCalledWith({ userId: ALICE.id });
    });
    // The retried load succeeds, so the rows swap in after the assertion above.
    // Let that commit land inside act() too.
    await settle();
  });

  it("reports a repeat failure that carries the same message", async () => {
    listUserSessionsMock.mockResolvedValue(sessionsFor("a"));
    revokeUserSessionMock.mockResolvedValue(failure);
    render(<AdminSessions />);
    await selectUser("Alice");
    await waitFor(() => {
      expect(listUserSessionsMock).toHaveBeenCalledWith({ userId: ALICE.id });
    });

    // Two failures in a row reporting the identical string are still two
    // events. Keying the toast on the message alone would swallow the second.
    await clickRevoke();
    expect(toastErrorMock).toHaveBeenCalledWith(
      FAILURE_MESSAGE,
      expect.anything()
    );

    await clickRevoke();
    expect(toastErrorMock).toHaveBeenCalledTimes(2);
  });
});
