import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Route } from "@/routes/signup";

interface AuthResult {
  error: { message: string } | null;
}

interface SessionResult {
  data: { user: { id: string } } | null;
  error: null;
}

interface SignUpEmailOptions {
  email: string;
  name: string;
  password: string;
  username: string;
  fetchOptions?: { headers: Record<string, string> };
}

const {
  getSessionMock,
  invalidate,
  navigate,
  signUpEmail,
  toastDismiss,
  toastError,
} = vi.hoisted(() => ({
  getSessionMock: vi.fn<() => Promise<SessionResult>>(),
  invalidate: vi.fn<() => Promise<void>>(),
  navigate: vi.fn<(opts: { to: string }) => void>(),
  signUpEmail: vi.fn<(opts: SignUpEmailOptions) => Promise<AuthResult>>(),
  toastDismiss: vi.fn<() => void>(),
  toastError: vi.fn<(message: string) => void>(),
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
    getSession: getSessionMock,
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
    useRouter: () => ({ invalidate, navigate }),
  };
});

const SignupPage = Route.options.component;

if (!SignupPage) {
  throw new Error("SignupPage component not found");
}

const fillUsername = () => {
  fireEvent.change(screen.getByLabelText("Username"), {
    target: { value: "testuser" },
  });
};

const fillValidFields = () => {
  fillUsername();
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
};

describe("SignupPage", () => {
  beforeEach(() => {
    // A successful sign-up signs the new user in before navigating home, so the
    // session read and the router refresh are part of the flow under test.
    getSessionMock
      .mockReset()
      .mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    invalidate.mockReset().mockResolvedValue(undefined);
    navigate.mockReset();
    signUpEmail.mockReset();
    toastDismiss.mockReset();
    toastError.mockReset();
  });

  it("renders the username, name, email, and password fields", () => {
    render(<SignupPage />);

    expect(screen.getByLabelText("Username")).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Create account" })
    ).toBeInTheDocument();
  });

  it("shows validation errors for empty fields", async () => {
    render(<SignupPage />);

    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    await expect(
      screen.findByText("Username is required.")
    ).resolves.toBeTruthy();
    expect(screen.getByText("Name is required.")).toBeInTheDocument();
    expect(screen.getByText("Email is required.")).toBeInTheDocument();
    expect(screen.getByText("Password is required.")).toBeInTheDocument();
    expect(signUpEmail).not.toHaveBeenCalled();
  });

  it("shows a validation error for a short password", async () => {
    render(<SignupPage />);

    fillUsername();
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

    fillValidFields();
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => {
      expect(signUpEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "user@example.com",
          name: "Test User",
          // oxlint-disable-next-line sonarjs/no-hardcoded-passwords -- Test fixture password
          password: "password123",
          username: "testuser",
        })
      );
    });
    expect(invalidate).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledWith({ to: "/" });
  });

  it("shows the server error message on failed sign-up", async () => {
    signUpEmail.mockResolvedValue({
      error: { message: "User already exists. Use another email." },
    });

    render(<SignupPage />);

    fillValidFields();
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
