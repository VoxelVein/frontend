import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SettingsDangerZone } from "@/components/settings/settings-danger-zone";
import type { AccountDeletionContext } from "@/lib/account.functions";

interface DeleteInput {
  data: { confirmation: string; keepProjectIds: string[]; password?: string };
}

const { deleteAccountMock, getContextMock, listAccountsMock, signOutMock } =
  vi.hoisted(() => ({
    deleteAccountMock: vi.fn<(input: DeleteInput) => Promise<object>>(),
    getContextMock: vi.fn<() => Promise<AccountDeletionContext>>(),
    listAccountsMock: vi.fn<() => Promise<object>>(),
    signOutMock: vi.fn<() => Promise<object>>(),
  }));

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- The component talks to Better Auth over the network; string paths avoid strict factory type-checking against the client types
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    $store: { notify: vi.fn<(signal: string) => void>() },
    changePassword: vi.fn<() => Promise<object>>(),
    listAccounts: listAccountsMock,
    signIn: {
      passkey: vi.fn<() => Promise<object>>(),
      social: vi.fn<() => Promise<object>>(),
    },
    signOut: signOutMock,
    useSession: () => ({
      data: { user: { email: "ada@example.com", id: "user-ada" } },
    }),
  },
}));

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- Server functions run on the server; a stub keeps the test on the component's behaviour
vi.mock("@/lib/account.functions", () => ({
  deleteAccount: deleteAccountMock,
  getAccountDeletionContext: getContextMock,
}));

const baseContext: AccountDeletionContext = {
  hasPassword: true,
  mode: "immediate",
  projects: [],
  reauthenticatedUntil: null,
  username: "ada",
};

const scheduledContext: AccountDeletionContext = {
  ...baseContext,
  mode: "scheduled",
  projects: [
    {
      id: "project-small",
      isProtected: false,
      name: "Tiny Tweaks",
      slug: "tiny-tweaks",
      status: "published",
    },
    {
      id: "project-large",
      isProtected: true,
      name: "Big Worlds",
      slug: "big-worlds",
      status: "published",
    },
  ],
};

const renderDangerZone = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <SettingsDangerZone onSignOut={vi.fn<() => void>()} />
    </QueryClientProvider>
  );
};

const openDeleteDialog = async () => {
  fireEvent.click(
    await screen.findByRole("button", { name: "Delete Account" })
  );
  return screen.findByRole("dialog");
};

describe("SettingsDangerZone account deletion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listAccountsMock.mockResolvedValue({ data: [], error: null });
    signOutMock.mockResolvedValue({});
  });

  it("explains that an account without projects is deleted immediately", async () => {
    getContextMock.mockResolvedValue(baseContext);
    renderDangerZone();
    await openDeleteDialog();

    await expect(
      screen.findByText(/deleted immediately and permanently/iu)
    ).resolves.toBeInTheDocument();
    expect(screen.queryByText(/after 14 days/iu)).not.toBeInTheDocument();
  });

  it("explains the 14-day grace period for project owners", async () => {
    getContextMock.mockResolvedValue(scheduledContext);
    renderDangerZone();
    await openDeleteDialog();

    await expect(
      screen.findByText(/permanently deleted after 14 days/iu)
    ).resolves.toBeInTheDocument();
    expect(
      screen.queryByText(/deleted immediately and permanently/iu)
    ).not.toBeInTheDocument();
  });

  it("offers a choice per project and locks protected projects", async () => {
    getContextMock.mockResolvedValue(scheduledContext);
    renderDangerZone();
    await openDeleteDialog();

    const choice = await screen.findByRole("group", { name: "Tiny Tweaks" });
    expect(choice).toContainElement(
      screen.getByRole("radio", { name: "Delete with my account" })
    );
    expect(
      screen.queryByRole("group", { name: "Big Worlds" })
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(
        /Kept — marked as a large project by the VoxelVein team/u
      )
    ).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(2);
  });

  it("deletes with the kept projects after a recent sign-in", async () => {
    getContextMock.mockResolvedValue({
      ...baseContext,
      mode: "scheduled",
      projects: [
        {
          id: "project-small",
          isProtected: false,
          name: "Tiny Tweaks",
          slug: "tiny-tweaks",
          status: "published",
        },
      ],
      reauthenticatedUntil: "2999-01-01T00:00:00.000Z",
    });
    deleteAccountMock.mockResolvedValue({
      purgeAt: "2026-10-10T00:00:00.000Z",
      status: "scheduled",
    });
    renderDangerZone();
    await openDeleteDialog();

    fireEvent.click(
      await screen.findByRole("radio", {
        name: "Keep (published without an owner)",
      })
    );
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    await expect(
      screen.findByRole("heading", { name: /confirm it’s you/iu })
    ).resolves.toHaveFocus();
    expect(screen.getByText(/verified/iu)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    const schedule = await screen.findByRole("button", {
      name: "Schedule deletion",
    });
    expect(schedule).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Type ada to confirm"), {
      target: { value: "ADA" },
    });
    fireEvent.click(schedule);

    await waitFor(() =>
      expect(deleteAccountMock).toHaveBeenCalledWith({
        data: { confirmation: "ADA", keepProjectIds: ["project-small"] },
      })
    );
    await expect(
      screen.findByRole("heading", { name: "Deletion scheduled" })
    ).resolves.toBeInTheDocument();
    expect(signOutMock).toHaveBeenCalledWith();
  });

  it("asks for the password when the sign-in is not recent", async () => {
    getContextMock.mockResolvedValue(baseContext);
    renderDangerZone();
    await openDeleteDialog();

    fireEvent.click(await screen.findByRole("button", { name: "Continue" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Continue with password" })
    );

    const password = screen.getByLabelText("Password");
    expect(password).toHaveAttribute("aria-invalid", "true");
    expect(password).toHaveAccessibleDescription(
      "Enter your password to continue."
    );
    expect(
      screen.getByRole("button", { name: "Use a passkey" })
    ).toBeInTheDocument();
  });

  it("points password-less accounts to the Security tab", async () => {
    getContextMock.mockResolvedValue({ ...baseContext, hasPassword: false });
    renderDangerZone();

    await expect(
      screen.findByRole("link", { name: "Go to Security" })
    ).resolves.toHaveAttribute("href", "/settings?tab=security");
    expect(
      screen.queryByRole("heading", { name: "Change Password" })
    ).not.toBeInTheDocument();
  });
});
