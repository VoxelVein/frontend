import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AdminUsers } from "@/components/admin/admin-users";

interface AdminUser {
  banReason: string | null;
  banned: boolean;
  createdAt: string;
  email: string;
  emailVerified: boolean;
  id: string;
  image: string | null;
  name: string;
  role: string;
}

/** The envelope Better Auth's `listUsers` resolves. */
interface UserListResponse {
  data: { total: number; users: AdminUser[] };
  error: null;
}

const { listUsersMock, unusedEndpoint, useSessionMock } = vi.hoisted(() => ({
  listUsersMock:
    vi.fn<
      () => Promise<{ data: { total: number; users: unknown[] }; error: null }>
    >(),
  // Better Auth's other admin endpoints, unused by these two assertions.
  // Declared in the same hoisted block as the factory that references it,
  // since a vi.mock factory is hoisted above ordinary top-level declarations.
  unusedEndpoint: vi.fn<() => Promise<{ error: null }>>(),
  useSessionMock:
    vi.fn<() => { data: { user: { id: string; role: string } } | null }>(),
}));

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- The component talks to the auth client and Better Auth's admin API; string paths avoid strict factory type-checking
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    admin: {
      banUser: unusedEndpoint,
      listUsers: listUsersMock,
      removeUser: unusedEndpoint,
      setRole: unusedEndpoint,
      unbanUser: unusedEndpoint,
    },
    useSession: useSessionMock,
  },
}));

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- Toasts fire into a portal outside the component tree; a stub keeps assertions on the DOM, not on the toast payload
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn<(message: string) => void>(),
    success: vi.fn<(message: string) => void>(),
  },
}));

// The row virtualizer measures a real scroll container, which jsdom reports as
// 0x0, so it windowizes every row out of view. Render every row instead.
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

const USER: AdminUser = {
  banReason: null,
  banned: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  email: "ada@example.com",
  emailVerified: true,
  id: "11111111-1111-4111-8111-111111111111",
  image: null,
  name: "Ada",
  role: "user",
};

/** The signed-in admin, distinct from `USER` so the row is not "your own". */
const OTHER_ADMIN_ID = "22222222-2222-4222-8222-222222222222";

/**
 * The list payload as Better Auth returns it.
 *
 * The envelope matters: the component destructures `{ data, error }` off the
 * response, so a bare `{ users: [...] }` resolves with `data === undefined` and
 * loads an empty list.
 */
const USER_LIST_RESPONSE: UserListResponse = {
  data: { total: 1, users: [USER] },
  error: null,
};

describe("AdminUsers role visibility", () => {
  beforeEach(() => {
    listUsersMock.mockReset().mockResolvedValue(USER_LIST_RESPONSE);
    useSessionMock.mockReset();
  });

  it("searches users in the database rather than paging a fixed list", async () => {
    // The previous version loaded the first 100 accounts once, which made every
    // user past that row unreachable: there was no way to look them up at all.
    // The query must carry the typed term so the server does the search.
    useSessionMock.mockReturnValue({
      data: { user: { id: OTHER_ADMIN_ID, role: "admin" } },
    });
    render(<AdminUsers />);

    fireEvent.change(screen.getByLabelText("Search users by name"), {
      target: { value: "Ali" },
    });

    // The field debounces at 300ms like the other search inputs, so this waits
    // on real time rather than a microtask flush.
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

  it("gives a moderator no account controls at all", async () => {
    // A different id: this staff member is looking at someone else's account.
    useSessionMock.mockReturnValue({
      data: { user: { id: OTHER_ADMIN_ID, role: "moderator" } },
    });
    render(<AdminUsers />);

    // The list loads in an effect, so wait for the row to appear before
    // asserting on the controls inside it. This doubles as the precondition
    // that keeps the absence assertions below from passing vacuously against
    // an empty list.
    await waitFor(() => {
      expect(screen.getByText("Ada")).toBeInTheDocument();
    });

    // Account management is admin-only. A moderator used to get the ban
    // control, which is what let them ban an admin; `manageUsers` now starts
    // at admin, so none of the four controls are rendered.
    expect(
      screen.queryByRole("button", { name: "Ban" })
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^role for/iu)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/remove ada/iu)).not.toBeInTheDocument();

    // The row still renders, so the panel reads as read-only rather than
    // broken.
    expect(screen.getByText("Ada")).toBeInTheDocument();
  });

  it("gives an admin the role selector and delete control", async () => {
    useSessionMock.mockReturnValue({
      data: { user: { id: OTHER_ADMIN_ID, role: "admin" } },
    });
    render(<AdminUsers />);

    await waitFor(() => {
      expect(screen.getByText("Ada")).toBeInTheDocument();
    });

    // An admin clears the rank check that hides both controls, and they are
    // named by the row so the target account is unambiguous.
    expect(screen.getByLabelText(/^role for/iu)).toBeInTheDocument();
    expect(screen.getByLabelText(/remove ada/iu)).toBeInTheDocument();
  });

  it("disables ban, delete, and role change on the admin's own row", async () => {
    // Same id as the listed user, so the row is the admin's own account.
    useSessionMock.mockReturnValue({
      data: { user: { id: USER.id, role: "admin" } },
    });
    render(<AdminUsers />);

    await waitFor(() => {
      expect(screen.getByText("Ada")).toBeInTheDocument();
    });

    // Better Auth rejects self-ban and self-remove outright, so the controls
    // stay present but inert. They are disabled rather than removed: a row
    // missing controls would read as a permissions bug rather than a choice.
    expect(screen.getByRole("button", { name: "Ban" })).toBeDisabled();
    expect(screen.getByLabelText(/remove ada/iu)).toBeDisabled();

    // Self-demotion would end the admin's own access mid-session, so the role
    // selector is inert too and relabelled to say the row is theirs.
    expect(screen.getByLabelText(/^your own role$/iu)).toBeDisabled();

    // The row explains where self-service actually lives.
    expect(
      screen.getByText("Manage your own account in Settings.")
    ).toBeInTheDocument();
  });

  it("lets an admin act on another admin", async () => {
    // Equal rank is allowed: only a handful of people hold the role, and two
    // admins need to be able to clean up a compromised peer. `canActOn` is
    // seniority, so admin-on-admin is 2 >= 2.
    const peer: AdminUser = { ...USER, name: "Rival", role: "admin" };
    listUsersMock.mockResolvedValue({
      data: { total: 1, users: [peer] },
      error: null,
    });
    useSessionMock.mockReturnValue({
      data: { user: { id: OTHER_ADMIN_ID, role: "admin" } },
    });
    render(<AdminUsers />);

    await waitFor(() => {
      expect(screen.getByText("Rival")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "Ban" })).toBeEnabled();
    expect(screen.getByLabelText(/remove rival/iu)).toBeEnabled();

    // No rank warning: an equal rank is not above yours.
    expect(
      screen.queryByText(
        "Your role cannot manage an account with a higher role than yours."
      )
    ).not.toBeInTheDocument();
  });

  it("shows the controls disabled on a row whose role is not recognised", async () => {
    // An unknown role outranks everyone and fails closed, matching `hasRole`.
    // The row explains why, so an inert button does not read as a bug.
    const odd: AdminUser = { ...USER, role: "superuser" };
    listUsersMock.mockResolvedValue({
      data: { total: 1, users: [odd] },
      error: null,
    });
    useSessionMock.mockReturnValue({
      data: { user: { id: OTHER_ADMIN_ID, role: "admin" } },
    });
    render(<AdminUsers />);

    await waitFor(() => {
      expect(
        screen.getByText(
          "Your role cannot manage an account with a higher role than yours."
        )
      ).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "Ban" })).toBeDisabled();
    expect(screen.getByLabelText(/remove ada/iu)).toBeDisabled();
  });

  it("leaves unban enabled on the admin's own row", async () => {
    // The recovery path if another admin ever bans this one. Gating it behind
    // the same self check would make a bad ban unrecoverable.
    const bannedSelf: AdminUser = {
      ...USER,
      banReason: "misconduct",
      banned: true,
      role: "admin",
    };
    listUsersMock.mockResolvedValue({
      data: { total: 1, users: [bannedSelf] },
      error: null,
    });
    useSessionMock.mockReturnValue({
      data: { user: { id: USER.id, role: "admin" } },
    });
    render(<AdminUsers />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Unban" })).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "Unban" })).toBeEnabled();
  });
});
