import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SettingsProfile } from "@/components/settings/settings-profile";
import { BIO_MAX_LENGTH } from "@/lib/bio";

interface UpdateUserInput {
  bio?: string | null;
  name?: string;
}

const { changeUsernameMock, confirmUsernameMock, updateUserMock } = vi.hoisted(
  () => ({
    changeUsernameMock: vi.fn<(input: { data: object }) => Promise<string>>(),
    confirmUsernameMock: vi.fn<(input: { data: object }) => Promise<string>>(),
    updateUserMock:
      vi.fn<
        (
          input: UpdateUserInput
        ) => Promise<{ error: { message: string } | null }>
      >(),
  })
);

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- The component talks to Better Auth over the network; string paths avoid strict factory type-checking against the client types
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    $store: { notify: vi.fn<(signal: string) => void>() },
    updateUser: updateUserMock,
  },
}));

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- Server functions reach the database at import time; string paths keep the test on the form
vi.mock("@/lib/account.functions", () => ({
  changeUsername: changeUsernameMock,
  confirmUsername: confirmUsernameMock,
}));

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- The card invalidates the router after saving; a stub avoids standing up a router
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="/">{children}</a>,
  useRouter: () => ({ invalidate: vi.fn<() => Promise<void>>() }),
}));

const user = {
  bio: "I make mods.",
  email: "ada@example.com",
  name: "Ada",
  username: "ada",
};

const bioBox = () =>
  screen.getByLabelText("Bio (Markdown)") as HTMLTextAreaElement;

const save = () =>
  fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

/** The username field alongside it queries availability, so it needs a client. */
const renderProfile = (props: { user: typeof user }) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <SettingsProfile user={props.user} />
    </QueryClientProvider>
  );
};

beforeEach(() => {
  vi.clearAllMocks();
  updateUserMock.mockResolvedValue({ error: null });
});

describe("SettingsProfile bio", () => {
  it("shows the saved bio in the field", () => {
    renderProfile({ user });

    expect(bioBox().value).toBe("I make mods.");
  });

  it("starts empty when the account has no bio", () => {
    renderProfile({ user: { ...user, bio: null } });

    expect(bioBox().value).toBe("");
  });

  it("saves the name and the bio together", async () => {
    renderProfile({ user });

    fireEvent.change(bioBox(), {
      target: { value: "I make mods and plugins." },
    });
    save();

    await waitFor(() => {
      expect(updateUserMock).toHaveBeenCalledWith({
        bio: "I make mods and plugins.",
        name: "Ada",
      });
    });
  });

  it("stores null when the bio is cleared, not an empty string", async () => {
    // Otherwise "no bio" and a bio that renders as nothing stay
    // indistinguishable.
    renderProfile({ user });

    fireEvent.change(bioBox(), { target: { value: "" } });
    save();

    await waitFor(() => {
      expect(updateUserMock).toHaveBeenCalledWith({
        bio: null,
        name: "Ada",
      });
    });
  });

  it("stores null when the bio is only whitespace", async () => {
    renderProfile({ user });

    fireEvent.change(bioBox(), { target: { value: "   \n  " } });
    save();

    await waitFor(() => {
      expect(updateUserMock).toHaveBeenCalledWith({ bio: null, name: "Ada" });
    });
  });

  it("trims the bio before saving it", async () => {
    renderProfile({ user });

    fireEvent.change(bioBox(), { target: { value: "  I make mods.  " } });
    save();

    await waitFor(() => {
      expect(updateUserMock).toHaveBeenCalledWith({
        bio: "I make mods.",
        name: "Ada",
      });
    });
  });

  it("marks the field invalid and explains why past the cap", async () => {
    renderProfile({ user });

    fireEvent.change(bioBox(), {
      target: { value: "a".repeat(BIO_MAX_LENGTH + 1) },
    });

    await waitFor(() => {
      expect(bioBox().getAttribute("aria-invalid")).toBe("true");
    });
    expect(
      screen.getByText(`Bio must be ${BIO_MAX_LENGTH} characters or fewer.`)
    ).toBeTruthy();
  });

  it("does not save a bio that is over the cap", async () => {
    renderProfile({ user });

    fireEvent.change(bioBox(), {
      target: { value: "a".repeat(BIO_MAX_LENGTH + 1) },
    });
    save();

    await waitFor(() => {
      expect(
        screen.getByText(`Bio must be ${BIO_MAX_LENGTH} characters or fewer.`)
      ).toBeTruthy();
    });
    expect(updateUserMock).toHaveBeenCalledTimes(0);
  });

  it("surfaces the server's message when the save is refused", async () => {
    updateUserMock.mockResolvedValue({
      error: { message: "Bio is too long." },
    });
    renderProfile({ user });

    save();

    await waitFor(() => {
      expect(screen.getByText("Bio is too long.")).toBeTruthy();
    });
  });

  it("confirms a successful save", async () => {
    renderProfile({ user });

    save();

    await waitFor(() => {
      expect(screen.getByText("Profile updated.")).toBeTruthy();
    });
  });

  it("tells the user the bio is Markdown and is public", () => {
    renderProfile({ user });

    expect(screen.getByText(/Markdown is supported/u).textContent).toContain(
      "Shown on your public profile."
    );
  });
});
