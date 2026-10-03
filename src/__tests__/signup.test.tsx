import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Route } from "@/routes/signup";

interface AuthResult {
  error: { message: string } | null;
}

const { navigate, signUpEmail, toastDismiss, toastError } = vi.hoisted(() => ({
  navigate: vi.fn<(opts: { to: string }) => void>(),
  toastDismiss: vi.fn<() => void>(),
  toastError: vi.fn<(message: string) => void>(),
  signUpEmail:
    vi.fn<
      (opts: {
        name: string;
        email: string;
        password: string;
      }) => Promise<AuthResult>
    >(),
}));

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- Action feedback is a toast; stubbing Sonner is what makes the call assertable
vi.mock("sonner", () => ({
  toast: {
    dismiss: toastDismiss,
    error: toastError,
    success: vi.fn<(message: string) => void>(),
  },
}));

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- Testing the signup form requires a faithful auth client stub; string path avoids strict factory type-checking against the real auth client
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    signUp: {
      email: signUpEmail,
    },
  },
}));

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- Server function is only used in beforeLoad, not by the component; string path avoids strict factory type-checking against the server function type
vi.mock("@/lib/auth.functions", () => ({
  getSession: vi.fn<() => Promise<null>>(),
}));

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- Router context is unavailable in unit tests; string path avoids strict factory type-checking against the router module
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal();
  // SAFETY: The actual module is spread at runtime to preserve createFileRoute/redirect; the cast only widens the type for the mock factory
  return {
    ...(actual as object),
    Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
      <a href={to}>{children}</a>
    ),
    useRouter: () => ({ navigate }),
  };
});

const SignupPage = Route.options.component;
if (!SignupPage) {
  throw new Error("SignupPage component not found");
}

describe("SignupPage", () => {
  beforeEach(() => {
    navigate.mockReset();
    signUpEmail.mockReset();
  });

  it("renders the name, email, and password fields", () => {
    render(<SignupPage />);

    expect(screen.getByLabelText("Name")).toBeTruthy();
    expect(screen.getByLabelText("Email")).toBeTruthy();
    expect(screen.getByLabelText("Password")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Create account" })).toBeTruthy();
  });

  it("shows validation errors for empty fields", async () => {
    render(<SignupPage />);

    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    await expect(screen.findByText("Name is required.")).resolves.toBeTruthy();
    expect(screen.getByText("Email is required.")).toBeTruthy();
    expect(screen.getByText("Password is required.")).toBeTruthy();
    expect(signUpEmail).not.toHaveBeenCalled();
  });

  it("shows a validation error for a short password", async () => {
    render(<SignupPage />);

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Test User" },
    });
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "short" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    await expect(
      screen.findByText("Password must be at least 8 characters.")
    ).resolves.toBeTruthy();
    expect(signUpEmail).not.toHaveBeenCalled();
  });

  it("calls signUp.email and navigates home on success", async () => {
    signUpEmail.mockResolvedValue({ error: null });

    render(<SignupPage />);

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Test User" },
    });
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      // oxlint-disable-next-line sonarjs/no-hardcoded-passwords -- Test fixture password
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => {
      expect(signUpEmail).toHaveBeenCalledWith({
        email: "user@example.com",
        name: "Test User",
        // oxlint-disable-next-line sonarjs/no-hardcoded-passwords -- Test fixture password
        password: "password123",
      });
    });
    expect(navigate).toHaveBeenCalledWith({ to: "/" });
  });

  it("shows the server error message on failed sign-up", async () => {
    signUpEmail.mockResolvedValue({
      error: { message: "User already exists. Use another email." },
    });

    render(<SignupPage />);

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Test User" },
    });
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      // oxlint-disable-next-line sonarjs/no-hardcoded-passwords -- Test fixture password
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    // Action feedback is a toast, which renders outside the form.
    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(
        "User already exists. Use another email."
      );
    });
    expect(navigate).not.toHaveBeenCalled();
  });
});
