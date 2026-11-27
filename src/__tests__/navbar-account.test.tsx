import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AuthButtons } from "@/components/navbar/auth-buttons";

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- Router context is unavailable in unit tests; string path avoids strict factory type-checking against the router module
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal();

  // SAFETY: The actual module is spread at runtime to preserve createFileRoute/redirect; the cast only widens the type for the mock factory
  return {
    ...(actual as object),
    Link: ({
      children,
      onClick,
      to,
    }: {
      children: React.ReactNode;
      onClick?: () => void;
      to: string;
    }) => (
      <a href={to} onClick={onClick}>
        {children}
      </a>
    ),
  };
});

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- The notification panel fetches server data at import time; this suite only checks the account links that sit beside it
vi.mock("@/components/navbar/user-notifications", () => ({
  UserNotifications: () => <button type="button">Notifications</button>,
}));

const renderMobileAccount = (role: string | null) =>
  render(
    <AuthButtons
      variant="mobile"
      isPending={false}
      session={{ user: { email: "ada@example.com", name: "Ada", role } }}
      onSignOut={vi.fn<() => void>()}
      onClose={vi.fn<() => void>()}
    />
  );

const linkHref = (name: string) =>
  screen.getByRole("link", { name }).getAttribute("href");

describe("AuthButtons mobile account", () => {
  it("lists the notifications and account destinations the desktop popups hold", () => {
    renderMobileAccount("moderator");

    expect(
      screen.getByRole("button", { name: "Notifications" })
    ).toBeInTheDocument();
    expect(linkHref("My projects")).toBe("/dashboard/projects");
    expect(linkHref("Support")).toBe("/support");
    expect(linkHref("Settings")).toBe("/settings");
    expect(
      screen.getByRole("button", { name: "Sign out" })
    ).toBeInTheDocument();
  });

  it("shows the admin panel only to roles that can view it", () => {
    renderMobileAccount("moderator");

    expect(linkHref("Admin panel")).toBe("/admin");
  });

  it("hides the admin panel from a plain user", () => {
    renderMobileAccount("user");

    expect(screen.queryByRole("link", { name: "Admin panel" })).toBeNull();
  });

  it("closes the drawer when an account link navigates", () => {
    const onClose = vi.fn<() => void>();

    render(
      <AuthButtons
        variant="mobile"
        isPending={false}
        session={{
          user: { email: "ada@example.com", name: "Ada", role: "moderator" },
        }}
        onSignOut={vi.fn<() => void>()}
        onClose={onClose}
      />
    );

    fireEvent.click(screen.getByRole("link", { name: "My projects" }));

    expect(onClose).toHaveBeenCalledOnce();
  });

  it("puts the avatar menu, not the bell, in the desktop bar", () => {
    render(
      <AuthButtons
        variant="desktop"
        isPending={false}
        session={{
          user: { email: "ada@example.com", name: "Ada", role: "moderator" },
        }}
        onSignOut={vi.fn<() => void>()}
        unreadCount={3}
      />
    );

    expect(
      screen.getByRole("button", {
        name: "Account menu for Ada, 3 unread notifications",
      })
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Notifications" })).toBeNull();
    expect(screen.queryByRole("link", { name: "My projects" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Sign out" })).toBeNull();
  });
});
