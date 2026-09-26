import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CookieBanner } from "@/components/cookie-banner";

const CONSENT_STORAGE_KEY = "voxelvein-cookie-consent";

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- Testing the cookie banner requires a faithful Link stub; string path avoids strict factory type-checking against the router module
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal();
  // SAFETY: The actual module is spread at runtime to preserve createFileRoute/redirect; the cast only widens the type for the mock factory
  return {
    ...(actual as object),
    Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
      <a href={to}>{children}</a>
    ),
  };
});

describe(CookieBanner, () => {
  it("renders when no consent has been stored", () => {
    render(<CookieBanner />);

    expect(screen.getByRole("region", { name: "Cookie consent" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Accept" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Decline" })).toBeTruthy();
  });

  it("does not render when consent has been accepted", () => {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, "accepted");

    render(<CookieBanner />);

    expect(screen.queryByRole("region", { name: "Cookie consent" })).toBeNull();
  });

  it("does not render when consent has been declined", () => {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, "declined");

    render(<CookieBanner />);

    expect(screen.queryByRole("region", { name: "Cookie consent" })).toBeNull();
  });

  it("persists the choice and hides after accepting", () => {
    render(<CookieBanner />);

    fireEvent.click(screen.getByRole("button", { name: "Accept" }));

    expect(window.localStorage.getItem(CONSENT_STORAGE_KEY)).toBe("accepted");
    expect(screen.queryByRole("region", { name: "Cookie consent" })).toBeNull();
  });

  it("persists the choice and hides after declining", () => {
    render(<CookieBanner />);

    fireEvent.click(screen.getByRole("button", { name: "Decline" }));

    expect(window.localStorage.getItem(CONSENT_STORAGE_KEY)).toBe("declined");
    expect(screen.queryByRole("region", { name: "Cookie consent" })).toBeNull();
  });
});
