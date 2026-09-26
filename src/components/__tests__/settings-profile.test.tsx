import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SettingsProfile } from "@/components/settings/settings-profile";
import { formatDate } from "@/lib/format";
import { USERNAME_CHANGE_COOLDOWN_MS } from "@/lib/usernames";

type UsernameCheck =
  | { available: true }
  | { available: false; message: string };

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const {
  changeUsernameMock,
  checkUsernameMock,
  confirmUsernameMock,
  invalidateMock,
  notifyMock,
  updateUserMock,
} = vi.hoisted(() => ({
  changeUsernameMock:
    vi.fn<(opts: { data: { username: string } }) => Promise<string>>(),
  checkUsernameMock:
    vi.fn<(opts: { data: { username: string } }) => Promise<UsernameCheck>>(),
  confirmUsernameMock:
    vi.fn<(opts: { data: { username: string } }) => Promise<string>>(),
  invalidateMock: vi.fn<() => Promise<void>>(),
  notifyMock: vi.fn<(signal: string) => void>(),
  updateUserMock: vi.fn<
    (opts: { name: string }) => Promise<{
      error: { message: string } | null;
    }>
  >(),
}));

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- Server functions run on the server; string path avoids strict factory type-checking against the server function types
vi.mock("@/lib/account.functions", () => ({
  changeUsername: changeUsernameMock,
  checkUsername: checkUsernameMock,
  confirmUsername: confirmUsernameMock,
}));

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- The component talks to Better Auth over the network; string path avoids strict factory type-checking against the client types
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    $store: { notify: notifyMock },
    updateUser: updateUserMock,
  },
}));

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- Router context is unavailable in unit tests; string path avoids strict factory type-checking against the router module
vi.mock("@tanstack/react-router", () => ({
  useRouter: () => ({ invalidate: invalidateMock }),
}));

const renderProfile = (user: Parameters<typeof SettingsProfile>[0]["user"]) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return render(<SettingsProfile user={user} />, { wrapper });
};

const baseUser = {
  email: "steve@example.com",
  name: "Steve",
  username: "steve",
  usernameChangedAt: null,
  usernameConfirmed: true,
};

describe(SettingsProfile, () => {
  beforeEach(() => {
    changeUsernameMock.mockReset();
    checkUsernameMock.mockReset();
    confirmUsernameMock.mockReset();
    invalidateMock.mockReset().mockResolvedValue();
    notifyMock.mockReset();
    updateUserMock.mockReset().mockResolvedValue({ error: null });
  });

  it("updates only the display name through updateUser", async () => {
    renderProfile(baseUser);

    fireEvent.change(screen.getByLabelText("Display name"), {
      target: { value: "Alex" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => {
      expect(updateUserMock).toHaveBeenCalledWith({ name: "Alex" });
    });
    expect(changeUsernameMock).not.toHaveBeenCalled();
    await expect(
      screen.findByText("Profile updated.")
    ).resolves.toBeInTheDocument();
    expect(notifyMock).toHaveBeenCalledWith("$sessionSignal");
  });

  it("locks the username during the cooldown and says until when", () => {
    const changedAt = new Date(Date.now() - DAY_IN_MS);
    const nextChange = new Date(
      changedAt.getTime() + USERNAME_CHANGE_COOLDOWN_MS
    );
    renderProfile({ ...baseUser, usernameChangedAt: changedAt });

    expect(screen.getByRole("textbox", { name: "Username" })).toBeDisabled();
    expect(
      screen.getByText(
        `You can change your username again on ${formatDate(nextChange.toISOString())}.`
      )
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Change username" })
    ).not.toBeInTheDocument();
  });

  it("allows a change once the cooldown has passed", () => {
    renderProfile({
      ...baseUser,
      usernameChangedAt: new Date(
        Date.now() - USERNAME_CHANGE_COOLDOWN_MS - DAY_IN_MS
      ),
    });

    expect(screen.getByRole("textbox", { name: "Username" })).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Change username" })
    ).toHaveAccessibleDescription(
      "After changing, you can't change it again for 14 days. Your old username keeps working for sign-in for 14 days."
    );
  });

  it("shows when a username is taken", async () => {
    checkUsernameMock.mockResolvedValue({
      available: false,
      message: "This username is already taken.",
    });
    renderProfile(baseUser);

    const field = screen.getByRole("textbox", { name: "Username" });
    fireEvent.change(field, { target: { value: "alex" } });

    await expect(
      screen.findByText("This username is already taken.")
    ).resolves.toBeInTheDocument();
    expect(checkUsernameMock).toHaveBeenCalledWith({
      data: { username: "alex" },
    });
    expect(field).toHaveAttribute("aria-invalid", "true");
  });

  it("shows when a username is available and changes it", async () => {
    checkUsernameMock.mockResolvedValue({ available: true });
    changeUsernameMock.mockResolvedValue("alex");
    renderProfile(baseUser);

    fireEvent.change(screen.getByRole("textbox", { name: "Username" }), {
      target: { value: "alex" },
    });

    await expect(
      screen.findByText("This username is available.")
    ).resolves.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Change username" }));

    await waitFor(() => {
      expect(changeUsernameMock).toHaveBeenCalledWith({
        data: { username: "alex" },
      });
    });
    await expect(
      screen.findByText("Username updated.")
    ).resolves.toBeInTheDocument();
    expect(updateUserMock).not.toHaveBeenCalled();
  });

  it("reports a rejected change inline", async () => {
    checkUsernameMock.mockResolvedValue({ available: true });
    changeUsernameMock.mockRejectedValue(
      new Error("This username is already taken.")
    );
    renderProfile(baseUser);

    fireEvent.change(screen.getByRole("textbox", { name: "Username" }), {
      target: { value: "alex" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Change username" }));

    await expect(screen.findByRole("alert")).resolves.toHaveTextContent(
      "This username is already taken."
    );
  });

  it("uses the first-time confirmation for unconfirmed accounts", async () => {
    confirmUsernameMock.mockResolvedValue("alex");
    checkUsernameMock.mockResolvedValue({ available: true });
    renderProfile({
      ...baseUser,
      username: "steve_1234",
      usernameConfirmed: false,
    });

    fireEvent.change(screen.getByRole("textbox", { name: "Username" }), {
      target: { value: "alex" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Change username" }));

    await waitFor(() => {
      expect(confirmUsernameMock).toHaveBeenCalledWith({
        data: { username: "alex" },
      });
    });
    expect(changeUsernameMock).not.toHaveBeenCalled();
  });
});
