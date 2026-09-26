import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SettingsSignInMethods } from "@/components/settings/settings-sign-in-methods";

interface AccountRow {
  accountId: string;
  id: string;
  providerId: string;
}

const { linkSocialMock, listAccountsMock, setPasswordMock, unlinkAccountMock } =
  vi.hoisted(() => ({
    linkSocialMock:
      vi.fn<
        (opts: { callbackURL: string; provider: string }) => Promise<object>
      >(),
    listAccountsMock: vi.fn<() => Promise<object>>(),
    setPasswordMock:
      vi.fn<(opts: { data: { newPassword: string } }) => Promise<void>>(),
    unlinkAccountMock:
      vi.fn<(opts: { accountId: string }) => Promise<object>>(),
  }));

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- The component talks to Better Auth over the network; string paths avoid strict factory type-checking against the client types
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    linkSocial: linkSocialMock,
    listAccounts: listAccountsMock,
    unlinkAccount: unlinkAccountMock,
  },
}));

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- Server functions run on the server; a stub keeps the test on the component's behaviour
vi.mock("@/lib/account.functions", () => ({
  setPassword: setPasswordMock,
}));

const account = (providerId: string): AccountRow => ({
  accountId: `${providerId}-remote`,
  id: `${providerId}-row`,
  providerId,
});

const renderMethods = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <SettingsSignInMethods />
    </QueryClientProvider>
  );
};

describe(SettingsSignInMethods, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "google-client");
    vi.stubEnv("VITE_GITHUB_CLIENT_ID", "");
  });

  it("disables unlinking the only sign-in method and explains why", async () => {
    listAccountsMock.mockResolvedValue({
      data: [account("google")],
      error: null,
    });
    renderMethods();

    const unlink = await screen.findByRole("button", {
      name: /unlink google/iu,
    });
    expect(unlink).toBeDisabled();
    expect(unlink).toHaveAccessibleDescription(/only linked sign-in method/iu);
    expect(
      screen.queryByRole("button", { name: /github/iu })
    ).not.toBeInTheDocument();
  });

  it("surfaces Better Auth's error when unlinking fails", async () => {
    listAccountsMock.mockResolvedValue({
      data: [account("credential"), account("google")],
      error: null,
    });
    unlinkAccountMock.mockResolvedValue({
      data: null,
      error: { message: "You can't unlink your last account" },
    });
    renderMethods();

    const unlink = await screen.findByRole("button", {
      name: /unlink google/iu,
    });
    expect(unlink).toBeEnabled();
    fireEvent.click(unlink);

    await expect(screen.findByRole("alert")).resolves.toHaveTextContent(
      "You can't unlink your last account"
    );
    expect(unlinkAccountMock).toHaveBeenCalledWith({ accountId: "google-row" });
  });

  it("offers a set-password form when there is no password", async () => {
    listAccountsMock.mockResolvedValue({
      data: [account("google")],
      error: null,
    });
    setPasswordMock.mockResolvedValue();
    renderMethods();

    await expect(screen.findByText("Not set")).resolves.toBeInTheDocument();
    const toggle = screen.getByRole("button", { name: "Set password" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);

    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "correct-horse" },
    });
    fireEvent.change(screen.getByLabelText("Confirm new password"), {
      target: { value: "correct-horse" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save password" }));

    await waitFor(() =>
      expect(setPasswordMock).toHaveBeenCalledWith({
        data: { newPassword: "correct-horse" },
      })
    );
    await expect(
      screen.findByText("Password set. You can now sign in with it.")
    ).resolves.toBeInTheDocument();
    expect(listAccountsMock).toHaveBeenCalledTimes(2);
  });

  it("hides the set-password action when a password exists", async () => {
    listAccountsMock.mockResolvedValue({
      data: [account("credential")],
      error: null,
    });
    renderMethods();

    await expect(screen.findByText("Set")).resolves.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Set password" })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^link google/iu })
    ).toBeInTheDocument();
  });
});
