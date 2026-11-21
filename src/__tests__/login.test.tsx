import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Route } from "@/routes/login";

interface AuthResult {
  error: { message: string } | null;
}

interface SessionResult {
  data: { user: { id: string } } | null;
  error: null;
}

interface SignInEmailOptions {
  email: string;
  fetchOptions?: { headers: Record<string, string> };
  password: string;
}

interface SignInPasskeyOptions {
  autoFill: boolean;
}

interface SignInUsernameOptions {
  fetchOptions?: { headers: Record<string, string> };
  password: string;
  username: string;
}

const {
  getSessionMock,
  invalidate,
  navigate,
  signInEmail,
  signInPasskey,
  signInUsername,
  toastDismiss,
  toastError,
} = vi.hoisted(() => ({
  getSessionMock: vi.fn<() => Promise<SessionResult>>(),
  invalidate: vi.fn<() => Promise<void>>(),
  navigate: vi.fn<(opts: { to: string }) => void>(),
  signInEmail: vi.fn<(opts: SignInEmailOptions) => Promise<AuthResult>>(),
  signInPasskey: vi.fn<(opts: SignInPasskeyOptions) => Promise<AuthResult>>(),
  signInUsername: vi.fn<(opts: SignInUsernameOptions) => Promise<AuthResult>>(),
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

// Cloudflare's documented always-passing test site key.
const TEST_SITE_KEY = "1x00000000000000000000AA";

const IDENTIFIER_LABEL = "Email or username";

const fillCredentials = (identifier: string) => {
  fireEvent.change(screen.getByLabelText(IDENTIFIER_LABEL), {
    target: { value: identifier },
  });
  fireEvent.change(screen.getByLabelText("Password"), {
    // oxlint-disable-next-line sonarjs/no-hardcoded-passwords -- Test fixture password
    target: { value: "password123" },
  });
};

const fillValidCredentials = () => {
  fillCredentials("user@example.com");
};

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- Testing the login form requires a faithful auth client stub; string path avoids strict factory type-checking against the real auth client
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    getSession: getSessionMock,
    signIn: {
      email: signInEmail,
      passkey: signInPasskey,
      username: signInUsername,
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

const LoginPage = Route.options.component;

if (!LoginPage) {
  throw new Error("LoginPage component not found");
}

describe("LoginPage", () => {
  beforeEach(() => {
    getSessionMock.mockReset();
    getSessionMock.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    invalidate.mockReset();
    navigate.mockReset();
    signInEmail.mockReset();
    signInPasskey.mockReset();
    signInUsername.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    delete window.turnstile;
  });

  it("renders the combined identifier and password fields", () => {
    render(<LoginPage />);

    expect(screen.getByLabelText(IDENTIFIER_LABEL)).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });

  it("offers no username/email toggle to switch between", () => {
    render(<LoginPage />);

    // The two identifiers share one field, so the old mode buttons are gone.
    expect(screen.queryByRole("button", { name: "Email" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Username" })).toBeNull();
  });

  it("shows validation errors for empty fields", async () => {
    render(<LoginPage />);

    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await expect(
      screen.findByText("Email or username is required.")
    ).resolves.toBeTruthy();
    expect(screen.getByText("Password is required.")).toBeInTheDocument();
    expect(signInEmail).not.toHaveBeenCalled();
    expect(signInUsername).not.toHaveBeenCalled();
  });

  it("shows a validation error for an email with no top-level domain", async () => {
    render(<LoginPage />);

    fillCredentials("user@example");
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await expect(
      screen.findByText("Enter a valid email address.")
    ).resolves.toBeTruthy();
    expect(signInEmail).not.toHaveBeenCalled();
    expect(signInUsername).not.toHaveBeenCalled();
  });

  it("shows a validation error for a username under three characters", async () => {
    render(<LoginPage />);

    fillCredentials("ab");
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await expect(
      screen.findByText("Username must be at least 3 characters.")
    ).resolves.toBeTruthy();
    expect(signInEmail).not.toHaveBeenCalled();
    expect(signInUsername).not.toHaveBeenCalled();
  });

  it("routes an identifier containing @ to signIn.email and navigates home", async () => {
    signInEmail.mockResolvedValue({ error: null });

    render(<LoginPage />);

    fillValidCredentials();
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => {
      expect(signInEmail).toHaveBeenCalledWith({
        email: "user@example.com",
        // oxlint-disable-next-line sonarjs/no-hardcoded-passwords -- Test fixture password
        password: "password123",
      });
    });
    expect(signInUsername).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith({ to: "/" });
  });

  it("routes an identifier without @ to signIn.username and navigates home", async () => {
    signInUsername.mockResolvedValue({ error: null });

    render(<LoginPage />);

    fillCredentials("alice");
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => {
      expect(signInUsername).toHaveBeenCalledWith({
        // oxlint-disable-next-line sonarjs/no-hardcoded-passwords -- Test fixture password
        password: "password123",
        username: "alice",
      });
    });
    expect(signInEmail).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith({ to: "/" });
  });

  it("trims surrounding whitespace from the identifier before dispatching", async () => {
    signInUsername.mockResolvedValue({ error: null });

    render(<LoginPage />);

    fillCredentials("  alice  ");
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => {
      expect(signInUsername).toHaveBeenCalledWith(
        expect.objectContaining({ username: "alice" })
      );
    });
  });

  it("shows the server error message on failed sign-in", async () => {
    signInEmail.mockResolvedValue({
      error: { message: "Invalid email or password" },
    });

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText(IDENTIFIER_LABEL), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "wrong-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    // Action feedback is a toast, which renders outside the form.
    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith("Invalid email or password");
    });
    expect(navigate).not.toHaveBeenCalled();
  });

  it("offers passkey sign-in when the browser supports WebAuthn", () => {
    vi.stubGlobal("PublicKeyCredential", {});

    render(<LoginPage />);

    expect(
      screen.getByRole("button", { name: "Sign in with passkey" })
    ).toBeInTheDocument();
    expect(screen.getByText("Settings → Security")).toBeInTheDocument();
  });

  it("hides passkey sign-in when the browser has no WebAuthn", () => {
    vi.stubGlobal("PublicKeyCredential", undefined);

    render(<LoginPage />);

    expect(
      screen.queryByRole("button", { name: "Sign in with passkey" })
    ).toBeNull();
  });

  it("signs in with a passkey and navigates home", async () => {
    vi.stubGlobal("PublicKeyCredential", {});
    signInPasskey.mockResolvedValue({ error: null });

    render(<LoginPage />);
    fireEvent.click(
      screen.getByRole("button", { name: "Sign in with passkey" })
    );

    await waitFor(() => {
      expect(signInPasskey).toHaveBeenCalledWith({ autoFill: true });
    });
    expect(invalidate).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledWith({ to: "/" });
  });

  it("shows the server error when passkey sign-in fails", async () => {
    vi.stubGlobal("PublicKeyCredential", {});
    signInPasskey.mockResolvedValue({
      error: { message: "No passkey was found for this device" },
    });

    render(<LoginPage />);
    fireEvent.click(
      screen.getByRole("button", { name: "Sign in with passkey" })
    );

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(
        "No passkey was found for this device"
      );
    });
    expect(navigate).not.toHaveBeenCalled();
  });

  it("requires the Turnstile check before signing in when enabled", async () => {
    vi.stubEnv("VITE_TURNSTILE_SITE_KEY", TEST_SITE_KEY);
    window.turnstile = {
      remove: vi.fn<(widgetId: string) => void>(),
      render: vi.fn<() => string>(() => "widget-1"),
      reset: vi.fn<(widgetId: string) => void>(),
    };

    render(<LoginPage />);
    fillValidCredentials();
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    // Action feedback is a toast, which renders outside the form.
    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(
        "Complete the human verification check before signing in."
      );
    });
    expect(signInEmail).not.toHaveBeenCalled();
  });

  it("sends the Turnstile token and resets the widget after a failure", async () => {
    vi.stubEnv("VITE_TURNSTILE_SITE_KEY", TEST_SITE_KEY);
    const reset = vi.fn<(widgetId: string) => void>();

    const renderWidget = vi.fn<NonNullable<typeof window.turnstile>["render"]>(
      (_container, options) => {
        options.callback("turnstile-token");

        return "widget-1";
      }
    );

    window.turnstile = {
      remove: vi.fn<(widgetId: string) => void>(),
      render: renderWidget,
      reset,
    };
    signInEmail.mockResolvedValue({
      error: { message: "Invalid email or password" },
    });

    render(<LoginPage />);
    await waitFor(() => {
      expect(renderWidget).toHaveBeenCalledWith(
        expect.any(HTMLElement),
        expect.objectContaining({ action: "login", sitekey: TEST_SITE_KEY })
      );
    });
    fillValidCredentials();
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => {
      expect(signInEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          fetchOptions: {
            headers: { "cf-turnstile-response": "turnstile-token" },
          },
        })
      );
    });
    await waitFor(() => {
      expect(reset).toHaveBeenCalledWith("widget-1");
    });
  });
});
