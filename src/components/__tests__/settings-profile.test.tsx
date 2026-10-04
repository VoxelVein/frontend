import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SettingsProfile } from "@/components/settings/settings-profile";
import { BIO_MAX_LENGTH } from "@/lib/bio";
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
  toastDismissMock,
  toastErrorMock,
  toastSuccessMock,
} = vi.hoisted(() => ({
  toastDismissMock: vi.fn<() => void>(),
  toastErrorMock: vi.fn<(message: string) => void>(),
  toastSuccessMock: vi.fn<(message: string) => void>(),
  changeUsernameMock:
    vi.fn<(opts: { data: { username: string } }) => Promise<string>>(),
  checkUsernameMock:
    vi.fn<(opts: { data: { username: string } }) => Promise<UsernameCheck>>(),
  confirmUsernameMock:
    vi.fn<(opts: { data: { username: string } }) => Promise<string>>(),
  invalidateMock: vi.fn<() => Promise<void>>(),
  notifyMock: vi.fn<(signal: string) => void>(),
  updateUserMock: vi.fn<
    (opts: { bio?: null | string; name: string }) => Promise<{
      error: { message: string } | null;
    }>
  >(),
}));

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- Action feedback is a toast; stubbing Sonner is what makes the call assertable
vi.mock("sonner", () => ({
  toast: {
    dismiss: toastDismissMock,
    error: toastErrorMock,
    success: toastSuccessMock,
  },
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
  const view = render(<SettingsProfile user={user} />, { wrapper });

  // Re-delivers the card with a new session, which is what `refreshSession`
  // causes in the app once a save lands.
  const rerenderAs = (next: typeof user) =>
    view.rerender(
      <QueryClientProvider client={queryClient}>
        <SettingsProfile user={next} />
      </QueryClientProvider>
    );

  return { ...view, rerenderAs };
};

const baseUser = {
  bio: null,
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

  it("updates the display name and bio, but never the username", async () => {
    renderProfile(baseUser);

    fireEvent.change(screen.getByLabelText("Display name"), {
      target: { value: "Alex" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => {
      expect(updateUserMock).toHaveBeenCalledWith({ bio: null, name: "Alex" });
    });
    // The username has its own path, so it must not ride along here.
    expect(changeUsernameMock).not.toHaveBeenCalled();
    // Action feedback is a toast, which renders outside the card.
    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith("Profile updated.");
    });
    expect(notifyMock).toHaveBeenCalledWith("$sessionSignal");
  });

  it("shows the saved bio in the field", () => {
    renderProfile({ ...baseUser, bio: "I make mods." });

    expect(screen.getByLabelText("Bio (Markdown)")).toHaveValue("I make mods.");
  });

  it("starts the bio empty when the account has none", () => {
    renderProfile(baseUser);

    expect(screen.getByLabelText("Bio (Markdown)")).toHaveValue("");
  });

  it("saves the bio alongside the name", async () => {
    renderProfile(baseUser);

    fireEvent.change(screen.getByLabelText("Bio (Markdown)"), {
      target: { value: "I make mods and plugins." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => {
      expect(updateUserMock).toHaveBeenCalledWith({
        bio: "I make mods and plugins.",
        name: "Steve",
      });
    });
  });

  it("stores null when the bio is cleared rather than an empty string", async () => {
    // Otherwise "no bio" and a bio that renders as nothing stay
    // indistinguishable.
    renderProfile({ ...baseUser, bio: "I make mods." });

    fireEvent.change(screen.getByLabelText("Bio (Markdown)"), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => {
      expect(updateUserMock).toHaveBeenCalledWith({ bio: null, name: "Steve" });
    });
  });

  it("treats a whitespace-only bio as no bio", async () => {
    renderProfile({ ...baseUser, bio: "I make mods." });

    fireEvent.change(screen.getByLabelText("Bio (Markdown)"), {
      target: { value: "   \n  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => {
      expect(updateUserMock).toHaveBeenCalledWith({ bio: null, name: "Steve" });
    });
  });

  it("trims the bio before saving it", async () => {
    renderProfile(baseUser);

    fireEvent.change(screen.getByLabelText("Bio (Markdown)"), {
      target: { value: "  I make mods.  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => {
      expect(updateUserMock).toHaveBeenCalledWith({
        bio: "I make mods.",
        name: "Steve",
      });
    });
  });

  it("refuses a bio past the cap and explains why", async () => {
    renderProfile(baseUser);

    const tooLong = "a".repeat(BIO_MAX_LENGTH + 1);
    fireEvent.change(screen.getByLabelText("Bio (Markdown)"), {
      target: { value: tooLong },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await expect(
      screen.findByText(`Bio must be ${BIO_MAX_LENGTH} characters or fewer.`)
    ).resolves.toBeInTheDocument();
    expect(screen.getByLabelText("Bio (Markdown)")).toHaveAttribute(
      "aria-invalid",
      "true"
    );
    expect(updateUserMock).not.toHaveBeenCalled();
  });

  it("surfaces the server's message when the save is refused", async () => {
    updateUserMock.mockResolvedValue({
      error: { message: "Bio is too long." },
    });
    renderProfile(baseUser);

    // Something to save first: Save is inert until the form is edited, so a
    // refusal can only happen after a change.
    fireEvent.change(screen.getByLabelText("Display name"), {
      target: { value: "Ada L" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    // A refused save is action feedback. Client-side field validation stays
    // inline and is covered by the cases below.
    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith("Bio is too long.");
    });
  });

  it("says the bio is Markdown and that it is public", () => {
    renderProfile(baseUser);

    expect(screen.getByText(/Markdown is supported/u)).toHaveTextContent(
      "Shown on your public profile."
    );
  });

  it("previews the bio as Markdown rather than leaving the reader to guess", async () => {
    renderProfile(baseUser);

    fireEvent.change(screen.getByLabelText("Bio (Markdown)"), {
      target: { value: "I make **mods**." },
    });

    // The field shows asterisks; the profile shows bold. Without a preview the
    // only way to know which you got was to save and go and look.
    await expect(
      screen.findByText("mods", { selector: "strong" })
    ).resolves.toBeInTheDocument();
  });

  it("shows the bio preview panel even when there is nothing to preview", () => {
    renderProfile(baseUser);

    // Otherwise the panel appears and disappears as the field is filled and
    // cleared, which reads as a glitch.
    expect(screen.getByText("Preview")).toBeInTheDocument();
    expect(screen.getByText(/your bio will appear here/iu)).toBeInTheDocument();
  });

  it("counts the characters left against the bio's cap", () => {
    renderProfile(baseUser);

    expect(screen.getByText(/500 characters left/u)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Bio (Markdown)"), {
      target: { value: "abcde" },
    });

    expect(screen.getByText(/495 characters left/u)).toBeInTheDocument();
  });

  it("keeps Save inert until something has actually changed", () => {
    renderProfile(baseUser);

    // A button that is always live invites a click that reports success without
    // having changed anything.
    expect(screen.getByRole("button", { name: "Save Changes" })).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Display name"), {
      target: { value: "Ada Lovelace" },
    });

    expect(screen.getByRole("button", { name: "Save Changes" })).toBeEnabled();
  });

  it("says when there are changes waiting to be saved", () => {
    renderProfile(baseUser);

    expect(screen.queryByText(/unsaved changes/iu)).toBeNull();

    fireEvent.change(screen.getByLabelText("Display name"), {
      target: { value: "Ada Lovelace" },
    });

    expect(screen.getByText(/unsaved changes/iu)).toBeInTheDocument();
  });

  it("clears the unsaved state once the session reports the saved values", async () => {
    const { rerenderAs } = renderProfile(baseUser);
    fireEvent.change(screen.getByLabelText("Display name"), {
      target: { value: "  Ada Lovelace  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => {
      expect(updateUserMock).toHaveBeenCalledWith({
        bio: null,
        name: "Ada Lovelace",
      });
    });

    // The baseline is read off the session, so the dirty state clears only once
    // the session reports what was stored — which is what refreshSession causes
    // in the app.
    rerenderAs({ ...baseUser, name: "Ada Lovelace" });

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Save Changes" })
      ).toBeDisabled();
    });
    expect(screen.queryByText(/unsaved changes/iu)).toBeNull();
  });

  it("forgets an edit that was typed and then taken back", () => {
    renderProfile(baseUser);
    const name = screen.getByLabelText("Display name");

    fireEvent.change(name, { target: { value: "Stevea" } });
    expect(screen.getByText(/unsaved changes/iu)).toBeInTheDocument();

    // The form library's own `isDirty` is a sticky flag, set on the first
    // keystroke and only ever cleared by `reset`, so it would still claim a
    // change here. This compares the value, which is back where it started.
    fireEvent.change(name, { target: { value: "Steve" } });

    expect(screen.queryByText(/unsaved changes/iu)).toBeNull();
    expect(screen.getByRole("button", { name: "Save Changes" })).toBeDisabled();
  });

  it("does not count whitespace-only edits as unsaved changes", () => {
    renderProfile(baseUser);
    const name = screen.getByLabelText("Display name");

    fireEvent.change(name, { target: { value: "Steve  " } });

    // Saving would store exactly what is already there, so reporting a pending
    // change would be a false alarm with nothing behind it.
    expect(screen.queryByText(/unsaved changes/iu)).toBeNull();
    expect(screen.getByRole("button", { name: "Save Changes" })).toBeDisabled();
  });

  it("counts a bio change as unsaved", () => {
    renderProfile(baseUser);

    fireEvent.change(screen.getByLabelText("Bio (Markdown)"), {
      target: { value: "I make mods." },
    });

    expect(screen.getByText(/unsaved changes/iu)).toBeInTheDocument();
  });

  it("keeps the username in the same card as the details", () => {
    renderProfile(baseUser);

    // One card, because it is one thing a person is doing: describing
    // themselves. The username appears beside their name on every project.
    const card = screen.getByRole("region", { name: "Profile" });

    expect(
      within(card).getByRole("textbox", { name: /display name/iu })
    ).toBeTruthy();
    expect(within(card).getByRole("textbox", { name: /bio/iu })).toBeTruthy();
    expect(
      within(card).getByRole("textbox", { name: /username/iu })
    ).toBeTruthy();
  });

  it("keeps the two groups' headings in order under one card heading", () => {
    renderProfile(baseUser);

    // A merged card still has to describe its parts, and an h3 under an h2 keeps
    // the hierarchy from skipping a level.
    const heading = screen.getByRole("heading", { name: "Profile" });
    expect(heading.tagName).toBe("H2");

    for (const name of ["Details", "Username"]) {
      expect(screen.getByRole("heading", { level: 3, name })).toBeTruthy();
    }
  });

  it("keeps two separate save actions, because they are two changes", () => {
    renderProfile(baseUser);

    // A username change goes through its own server functions, which enforce the
    // cooldown and the reservations. One button across both would have to choose
    // a path, and these are different changes with different consequences.
    expect(screen.getByRole("button", { name: "Save Changes" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Change username" })
    ).toBeTruthy();
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
    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith("Username updated.");
    });
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

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith(
        "This username is already taken."
      );
    });
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
