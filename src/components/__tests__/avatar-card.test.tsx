import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AvatarCard } from "@/components/settings/avatar-card";

/** The fields `uploadAvatar` resolves with; the card never reads them. */
interface UploadedAvatarResult {
  contentType: string;
  height: number;
  size: number;
  url: string;
  width: number;
}

const {
  deleteAvatarMock,
  invalidateMock,
  notifyMock,
  setAvatarUrlMock,
  toastDismissMock,
  toastErrorMock,
  uploadAvatarMock,
} = vi.hoisted(() => ({
  deleteAvatarMock: vi.fn<() => Promise<void>>(),
  invalidateMock: vi.fn<() => Promise<void>>(),
  notifyMock: vi.fn<(signal: string) => void>(),
  setAvatarUrlMock: vi.fn<(opts: { data: { url: string } }) => Promise<void>>(),
  toastDismissMock: vi.fn<() => void>(),
  toastErrorMock: vi.fn<(message: string) => void>(),
  uploadAvatarMock:
    vi.fn<(opts: { file: File }) => Promise<UploadedAvatarResult>>(),
}));

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- Action feedback is a toast; stubbing Sonner is what makes the call assertable
vi.mock("sonner", () => ({
  toast: { dismiss: toastDismissMock, error: toastErrorMock },
}));

// oxlint-disable no-script-url -- Adversarial input: this test exists to prove the exact
// string reaches the validator and is refused before any request is made.
// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- Server function and upload client run on the server / over the network; string paths avoid strict factory type-checking
vi.mock("@/lib/account.functions", () => ({
  setAvatarUrl: setAvatarUrlMock,
}));

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- Uploads go over the network to the avatar route; stubbing the client keeps this suite on the card's own behaviour
vi.mock(import("@/lib/upload-client"), () => ({
  deleteAvatar: deleteAvatarMock,
  uploadAvatar: uploadAvatarMock,
}));

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- The card invalidates the cached session after a change; a stub keeps this suite on what the card renders
vi.mock("@/lib/auth-client", () => ({
  authClient: { $store: { notify: notifyMock } },
}));

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- Router context is unavailable in unit tests; a stub keeps the invalidate call assertable
vi.mock("@tanstack/react-router", () => ({
  useRouter: () => ({ invalidate: invalidateMock }),
}));

const field = () => screen.getByLabelText("Image URL");
const saveButton = () =>
  screen.getByRole("button", { name: /use image url/iu });

const URL_ERROR_TEXT = "Enter an https:// image URL.";

/**
 * The field's validation message. Queried by text rather than by role because
 * the card also contains an informational `Alert`, which is an alert role too.
 */
const errorMessage = () => screen.findByText(URL_ERROR_TEXT);

const typeUrl = (value: string) => {
  fireEvent.change(field(), { target: { value } });
};

const submit = () => {
  fireEvent.click(saveButton());
};

describe(AvatarCard, () => {
  beforeEach(() => {
    deleteAvatarMock.mockReset().mockResolvedValue();
    setAvatarUrlMock.mockReset().mockResolvedValue();
    toastDismissMock.mockReset();
    toastErrorMock.mockReset();
    uploadAvatarMock.mockReset().mockResolvedValue({
      contentType: "image/png",
      height: 64,
      size: 1024,
      url: "/api/avatar/new",
      width: 64,
    });
  });

  it("offers an image URL field with a visible label", () => {
    render(<AvatarCard image={null} name="Hedi Zandi" />);

    expect(field()).toBeInTheDocument();
    expect(saveButton()).toBeInTheDocument();
  });

  it("saves an https URL", async () => {
    render(<AvatarCard image={null} name="Hedi Zandi" />);
    typeUrl("https://cdn.example.com/me.png");
    submit();

    await waitFor(() => {
      expect(setAvatarUrlMock).toHaveBeenCalledWith({
        data: { url: "https://cdn.example.com/me.png" },
      });
    });
  });

  it("refuses a plain http URL before it reaches the server", async () => {
    render(<AvatarCard image={null} name="Hedi Zandi" />);
    typeUrl("http://cdn.example.com/me.png");
    submit();

    // Checked here as well as on the server so the reason appears next to the
    // field instead of arriving as an unexplained toast.
    expect(setAvatarUrlMock).not.toHaveBeenCalled();
    await expect(errorMessage()).resolves.toHaveTextContent(
      /enter an https:\/\/ image url/iu
    );
  });

  it("refuses a javascript: URL", async () => {
    render(<AvatarCard image={null} name="Hedi Zandi" />);
    typeUrl("javascript:alert(1)");
    submit();

    expect(setAvatarUrlMock).not.toHaveBeenCalled();
    await expect(errorMessage()).resolves.toHaveTextContent(
      /enter an https:\/\/ image url/iu
    );
  });

  it("marks the field invalid and points at the error", async () => {
    render(<AvatarCard image={null} name="Hedi Zandi" />);
    typeUrl("nonsense");
    submit();

    const input = await screen.findByLabelText("Image URL");

    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby");
  });

  it("clears the error as soon as the value is edited again", async () => {
    render(<AvatarCard image={null} name="Hedi Zandi" />);
    typeUrl("nonsense");
    submit();
    await expect(errorMessage()).resolves.toBeInTheDocument();

    typeUrl("https://cdn.example.com/me.png");

    expect(screen.queryByText(URL_ERROR_TEXT)).not.toBeInTheDocument();
    expect(field()).not.toHaveAttribute("aria-invalid");
  });

  it("lets the picture be cleared by saving an empty field", async () => {
    render(<AvatarCard image="https://cdn.example.com/me.png" name="Ada" />);
    submit();

    await waitFor(() => {
      expect(setAvatarUrlMock).toHaveBeenCalledWith({ data: { url: "" } });
    });
  });

  it("reports a server failure and keeps the typed URL", async () => {
    setAvatarUrlMock.mockRejectedValue(new Error("Could not save."));
    render(<AvatarCard image={null} name="Hedi Zandi" />);
    typeUrl("https://cdn.example.com/me.png");
    submit();

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith("Could not save.");
    });

    // Keeping the value lets the user retry without retyping it.
    expect(field()).toHaveValue("https://cdn.example.com/me.png");
  });

  it("says where a picture is hosted, since the preview cannot show it", () => {
    const { unmount } = render(
      <AvatarCard image="https://cdn.example.com/me.png" name="Ada" />
    );

    expect(screen.getByText(/hosted on another site/iu)).toBeInTheDocument();
    unmount();

    render(<AvatarCard image="/api/avatar/2f1c-uuid" name="Ada" />);
    expect(screen.getByText(/stored on voxelvein/iu)).toBeInTheDocument();
  });

  it("says nothing about hosting when there is no picture", () => {
    render(<AvatarCard image={null} name="Ada" />);

    expect(
      screen.queryByText(/hosted on another site/iu)
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/stored on voxelvein/iu)).not.toBeInTheDocument();
  });

  it("sends no referrer with the preview, so the host learns no page URL", () => {
    const { container } = render(
      <AvatarCard image="https://cdn.example.com/me.png" name="Ada" />
    );

    expect(container.querySelector("img")).toHaveAttribute(
      "referrerpolicy",
      "no-referrer"
    );
  });

  it("offers no Remove button until there is a picture", () => {
    const { unmount } = render(<AvatarCard image={null} name="Ada" />);

    expect(
      screen.queryByRole("button", { name: /remove/iu })
    ).not.toBeInTheDocument();
    unmount();

    render(<AvatarCard image="/api/avatar/2f1c-uuid" name="Ada" />);
    expect(
      screen.getByRole("button", { name: /remove/iu })
    ).toBeInTheDocument();
  });

  it("invalidates the cached session so the navbar repaints without a reload", async () => {
    render(<AvatarCard image={null} name="Hedi Zandi" />);
    typeUrl("https://cdn.example.com/me.png");
    submit();

    // The reported symptom: the picture saved, but the navbar and account menu
    // kept the old one until the page was reloaded, because the card fetched the
    // fresh session without telling the store the navbar reads.
    await waitFor(() => {
      expect(notifyMock).toHaveBeenCalledWith("$sessionSignal");
    });
    expect(invalidateMock).toHaveBeenCalledWith();
  });

  it("still clears the field after a successful save", async () => {
    render(<AvatarCard image={null} name="Hedi Zandi" />);
    typeUrl("https://cdn.example.com/me.png");
    submit();

    await waitFor(() => {
      expect(field()).toHaveValue("");
    });
  });
});
