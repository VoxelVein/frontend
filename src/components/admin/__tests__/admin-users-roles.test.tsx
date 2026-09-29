import { render, screen, waitFor } from "@testing-library/react";
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
  useSessionMock: vi.fn<() => { data: { user: { role: string } } | null }>(),
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

  it("gives a moderator the ban control but not delete or role change", async () => {
    useSessionMock.mockReturnValue({
      data: { user: { role: "moderator" } },
    });
    render(<AdminUsers />);

    // The list loads in an effect, so wait for the row to appear before
    // asserting on the controls inside it. This doubles as the precondition
    // that keeps the absence assertions below from passing vacuously against
    // an empty list.
    await waitFor(() => {
      expect(screen.getByText("Ada")).toBeInTheDocument();
    });

    // A moderator may still act on a misbehaving account.
    expect(screen.getByRole("button", { name: "Ban" })).toBeInTheDocument();

    // The role selector and the delete button are admin-only, so a moderator
    // must not find them by any accessible name.
    expect(screen.queryByLabelText(/^role for/iu)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/remove ada/iu)).not.toBeInTheDocument();
  });

  it("gives an admin the role selector and delete control", async () => {
    useSessionMock.mockReturnValue({ data: { user: { role: "admin" } } });
    render(<AdminUsers />);

    await waitFor(() => {
      expect(screen.getByText("Ada")).toBeInTheDocument();
    });

    // An admin clears the rank check that hides both controls, and they are
    // named by the row so the target account is unambiguous.
    expect(screen.getByLabelText(/^role for/iu)).toBeInTheDocument();
    expect(screen.getByLabelText(/remove ada/iu)).toBeInTheDocument();
  });
});
