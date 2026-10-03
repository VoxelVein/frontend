import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AvatarCard } from "@/components/settings/avatar-card";

// oxlint-disable no-script-url -- This suite covers a field that accepts a URL a
// person typed, and the `javascript:` case is one of the payloads the card has to
// refuse. Writing it out of reach of the linter would defeat what is under test.

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
  storageConfiguredMock,
  toastDismissMock,
  toastErrorMock,
  toastSuccessMock,
  uploadAvatarMock,
} = vi.hoisted(() => ({
  deleteAvatarMock: vi.fn<() => Promise<void>>(),
  invalidateMock: vi.fn<() => Promise<void>>(),
  notifyMock: vi.fn<(signal: string) => void>(),
  setAvatarUrlMock: vi.fn<(opts: { data: { url: string } }) => Promise<void>>(),
  storageConfiguredMock: vi.fn<() => Promise<boolean>>(),
  toastDismissMock: vi.fn<() => void>(),
  toastErrorMock: vi.fn<(message: string) => void>(),
  toastSuccessMock: vi.fn<(message: string) => void>(),
  uploadAvatarMock:
    vi.fn<(opts: { file: File }) => Promise<UploadedAvatarResult>>(),
}));

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- Action feedback is a toast; stubbing Sonner is what makes the call assertable
vi.mock("sonner", () => ({
  toast: {
    dismiss: toastDismissMock,
    error: toastErrorMock,
    success: toastSuccessMock,
  },
}));

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- Server function and upload client run on the server / over the network; string paths avoid strict factory type-checking
vi.mock("@/lib/account.functions", () => ({
  setAvatarUrl: setAvatarUrlMock,
}));

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- The card gates its upload control on this server function, which reaches env.config at import time; string paths avoid strict factory type-checking
vi.mock("@/lib/storage.functions", () => ({
  storageIsConfigured: storageConfiguredMock,
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

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- Links need a router instance; a plain anchor keeps this suite on the card
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="/">{children}</a>,
  // The refresh hook invalidates the router after a change.
  useRouter: () => ({ invalidate: invalidateMock }),
}));

/**
 * The card gates its upload control on a query, so every render needs a client.
 * A fresh one per render keeps the availability answer from leaking between
 * tests.
 */
const renderCard = (props: { image: string | null; name: string }) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return render(<AvatarCard {...props} />, { wrapper: Wrapper });
};

/**
 * The URL field lives on its own tab, because uploading and linking are
 * alternatives rather than two things to do at once.
 */
const openUrlTab = async () => {
  fireEvent.click(screen.getByRole("tab", { name: /from a url/iu }));
  return await screen.findByLabelText("Image URL");
};

const field = () => screen.getByLabelText("Image URL");

const typeUrl = (value: string) => {
  fireEvent.change(field(), { target: { value } });
};

const submit = () => {
  fireEvent.click(screen.getByRole("button", { name: /use this image/iu }));
};

const URL_ERROR_TEXT = "Enter an https:// image URL.";

/**
 * The field's validation message. Queried by text rather than by role because
 * the card also contains an informational `Alert`, which is an alert role too.
 */
const errorMessage = () => screen.findByText(URL_ERROR_TEXT);

describe(AvatarCard, () => {
  beforeEach(() => {
    deleteAvatarMock.mockReset().mockResolvedValue();
    invalidateMock.mockReset().mockResolvedValue();
    notifyMock.mockReset();
    setAvatarUrlMock.mockReset().mockResolvedValue();
    // Configured, so the upload control behaves as it does in production and
    // these tests stay about the picture rather than about the gate.
    storageConfiguredMock.mockReset().mockResolvedValue(true);
    toastDismissMock.mockReset();
    toastErrorMock.mockReset();
    toastSuccessMock.mockReset();
    uploadAvatarMock.mockReset().mockResolvedValue({
      contentType: "image/png",
      height: 64,
      size: 1024,
      url: "/api/avatar/new",
      width: 64,
    });
  });

  it("offers the two sources as tabs rather than two stacked forms", async () => {
    renderCard({ image: null, name: "Hedi Zandi" });

    // Uploading and linking are alternatives — a picture comes from one of them —
    // and showing both at once gave the URL field the weight of a second
    // primary action.
    expect(screen.getByRole("tab", { name: /upload/iu })).toBeInTheDocument();
    await expect(openUrlTab()).resolves.toBeInTheDocument();
  });

  it("keeps the URL field off the upload tab", () => {
    renderCard({ image: null, name: "Hedi Zandi" });

    expect(screen.queryByLabelText("Image URL")).not.toBeInTheDocument();
  });

  it("saves an https URL", async () => {
    renderCard({ image: null, name: "Hedi Zandi" });
    await openUrlTab();
    typeUrl("https://cdn.example.com/me.png");
    submit();

    await waitFor(() => {
      expect(setAvatarUrlMock).toHaveBeenCalledWith({
        data: { url: "https://cdn.example.com/me.png" },
      });
    });
  });

  it("previews a typed URL before it is saved", async () => {
    renderCard({ image: null, name: "Hedi Zandi" });
    await openUrlTab();
    typeUrl("https://cdn.example.com/me.png");

    // Without this, the only way to learn an address points at nothing is to
    // save it, reload, and look at the result.
    // Queried from the document rather than by role: the preview's alt is empty,
    // which makes it a presentational image, not an `img` role.
    expect(
      document.querySelector('img[src="https://cdn.example.com/me.png"]')
    ).toBeTruthy();
    expect(
      screen.getByText(/preview of the image you typed/iu)
    ).toBeInTheDocument();
  });

  it("previews nothing for an address it has already refused", async () => {
    renderCard({ image: null, name: "Hedi Zandi" });
    await openUrlTab();
    typeUrl("not-a-url");

    expect(screen.queryByText(/preview of the image you typed/iu)).toBeNull();
  });

  it("refuses a plain http URL before it reaches the server", async () => {
    renderCard({ image: null, name: "Hedi Zandi" });
    await openUrlTab();
    typeUrl("http://cdn.example.com/me.png");
    submit();

    // Checked here as well as on the server so the reason appears next to the
    // field instead of arriving as an unexplained toast.
    expect(setAvatarUrlMock).not.toHaveBeenCalled();
    await expect(errorMessage()).resolves.toHaveTextContent(URL_ERROR_TEXT);
  });

  it("refuses a javascript: URL", async () => {
    renderCard({ image: null, name: "Hedi Zandi" });
    await openUrlTab();
    typeUrl("javascript:alert(1)");
    submit();

    expect(setAvatarUrlMock).not.toHaveBeenCalled();
    await expect(errorMessage()).resolves.toBeInTheDocument();
  });

  it("marks the field invalid and points at the error", async () => {
    renderCard({ image: null, name: "Hedi Zandi" });
    await openUrlTab();
    typeUrl("nonsense");
    submit();

    const input = await screen.findByLabelText("Image URL");

    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby");
  });

  it("clears the error as soon as the value is edited again", async () => {
    renderCard({ image: null, name: "Hedi Zandi" });
    await openUrlTab();
    typeUrl("nonsense");
    submit();
    await expect(errorMessage()).resolves.toBeInTheDocument();

    typeUrl("https://cdn.example.com/me.png");

    expect(screen.queryByText(URL_ERROR_TEXT)).not.toBeInTheDocument();
    expect(field()).not.toHaveAttribute("aria-invalid");
  });

  it("lets the picture be cleared by saving an empty field", async () => {
    renderCard({ image: "https://cdn.example.com/me.png", name: "Ada" });
    await openUrlTab();
    submit();

    await waitFor(() => {
      expect(setAvatarUrlMock).toHaveBeenCalledWith({ data: { url: "" } });
    });
  });

  it("reports a server failure and keeps the typed URL", async () => {
    setAvatarUrlMock.mockRejectedValue(new Error("Could not save."));
    renderCard({ image: null, name: "Hedi Zandi" });
    await openUrlTab();
    typeUrl("https://cdn.example.com/me.png");
    submit();

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith("Could not save.");
    });

    // Keeping the value lets the user retry without retyping it.
    expect(field()).toHaveValue("https://cdn.example.com/me.png");
  });

  it("says where a picture is hosted, since the preview cannot show it", () => {
    const { unmount } = renderCard({
      image: "https://cdn.example.com/me.png",
      name: "Ada",
    });

    // And who is serving it to every visitor.
    expect(screen.getByText(/loaded from another site/iu)).toBeInTheDocument();
    unmount();

    renderCard({ image: "/api/avatar/2f1c-uuid", name: "Ada" });
    expect(screen.getByText(/stored on voxelvein/iu)).toBeInTheDocument();
  });

  it("says plainly that there is no picture yet", () => {
    renderCard({ image: null, name: "Ada" });

    // Said twice on purpose: once as the current state, once as what a visitor
    // will see until a picture is added.
    expect(screen.getAllByText(/no picture yet/iu).length).toBeGreaterThan(0);
    expect(screen.getByText(/you will see this initial/iu)).toBeInTheDocument();
  });

  it("offers no removal at all when there is nothing to remove", () => {
    renderCard({ image: null, name: "Ada" });

    expect(
      screen.queryByRole("button", { name: /remove picture/iu })
    ).not.toBeInTheDocument();
  });

  it("does not remove a picture on the first click", async () => {
    renderCard({ image: "/api/avatar/2f1c-uuid", name: "Ada" });

    fireEvent.click(screen.getByRole("button", { name: /remove picture/iu }));

    // Removing an uploaded picture destroys the stored object, so one click is
    // not enough.
    expect(deleteAvatarMock).not.toHaveBeenCalled();
    // The confirmation is present and the picture is still there.
    await expect(
      screen.findByRole("button", { name: "Yes, remove it" })
    ).resolves.toBeInTheDocument();
  });

  it("removes once the confirmation is accepted", async () => {
    renderCard({ image: "/api/avatar/2f1c-uuid", name: "Ada" });
    fireEvent.click(screen.getByRole("button", { name: /remove picture/iu }));

    fireEvent.click(
      await screen.findByRole("button", { name: "Yes, remove it" })
    );

    await waitFor(() => {
      expect(deleteAvatarMock).toHaveBeenCalledWith();
    });
  });

  it("says an uploaded picture will be deleted, and a linked one only unlinked", async () => {
    // The consequences differ: a stored object is destroyed, a third-party URL
    // just stops being referenced. Saying the wrong one would frighten someone
    // out of an action that costs them nothing.
    const { unmount } = renderCard({
      image: "/api/avatar/2f1c-uuid",
      name: "Ada",
    });
    fireEvent.click(screen.getByRole("button", { name: /remove picture/iu }));
    await expect(
      screen.findByText(/stored copy is deleted/iu)
    ).resolves.toBeInTheDocument();
    unmount();

    renderCard({ image: "https://cdn.example.com/me.png", name: "Ada" });
    fireEvent.click(screen.getByRole("button", { name: /remove picture/iu }));
    await expect(
      screen.findByText(/stays where it is/iu)
    ).resolves.toBeInTheDocument();
  });

  it("sends no referrer with the preview, so the host learns no page URL", () => {
    const { container } = renderCard({
      image: "https://cdn.example.com/me.png",
      name: "Ada",
    });

    expect(container.querySelector("img")).toHaveAttribute(
      "referrerpolicy",
      "no-referrer"
    );
  });

  it("invalidates the cached session so the navbar repaints without a reload", async () => {
    renderCard({ image: null, name: "Hedi Zandi" });
    await openUrlTab();
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

  it("clears the field after a successful save", async () => {
    renderCard({ image: null, name: "Hedi Zandi" });
    await openUrlTab();
    typeUrl("https://cdn.example.com/me.png");
    submit();

    await waitFor(() => {
      expect(field()).toHaveValue("");
    });
  });
});
