import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ImageManager } from "@/components/dashboard/image-manager";
import { PROJECT_IMAGE_KIND } from "@/lib/projects";

interface UploadedImage {
  contentType: string;
  height: number;
  id: string;
  kind: string;
  size: number;
  url: string;
  width: number;
}

const {
  deleteProjectImageMock,
  storageIsConfiguredMock,
  toastDismissMock,
  toastErrorMock,
  uploadProjectImageMock,
} = vi.hoisted(() => ({
  deleteProjectImageMock: vi.fn<() => Promise<void>>(),
  storageIsConfiguredMock: vi.fn<() => Promise<boolean>>(),
  toastDismissMock: vi.fn<() => void>(),
  toastErrorMock: vi.fn<(message: string) => void>(),
  uploadProjectImageMock:
    vi.fn<
      (opts: {
        file: File;
        kind: string;
        projectId: string;
      }) => Promise<UploadedImage>
    >(),
}));

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- The cropper needs a real canvas, which jsdom does not implement; a stub keeps this suite on what the manager does with the cropped file
vi.mock("@/components/image-crop-modal", () => ({
  ImageCropModal: ({
    onCancel,
    onConfirm,
  }: {
    onCancel: () => void;
    onConfirm: (file: File) => void;
  }) => (
    <dialog aria-label="Image cropper" open>
      <button
        onClick={() =>
          onConfirm(
            new File(["cropped"], "cropped.webp", { type: "image/webp" })
          )
        }
        type="button"
      >
        Confirm crop
      </button>
      <button onClick={onCancel} type="button">
        Cancel crop
      </button>
    </dialog>
  ),
}));

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- Uploads go over XMLHttpRequest; stubbing the client keeps this suite on the manager's choices
vi.mock("@/lib/upload-client", () => ({
  deleteProjectImage: deleteProjectImageMock,
  uploadProjectImage: uploadProjectImageMock,
}));

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- Storage availability is a server query; the manager only reads the boolean
vi.mock("@/lib/storage.functions", () => ({
  storageIsConfigured: storageIsConfiguredMock,
}));

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- Action feedback is a toast; stubbing Sonner makes calls assertable
vi.mock("sonner", () => ({
  toast: { dismiss: toastDismissMock, error: toastErrorMock },
}));

const uploaded: UploadedImage = {
  contentType: "image/webp",
  height: 512,
  id: "image-1",
  kind: "icon",
  size: 1024,
  url: "/api/project-image/image-1",
  width: 512,
};

const onChange =
  vi.fn<(next: { gallery?: unknown[]; icon?: unknown }) => void>();

/** The storage gate reads a query, so every mount gets its own client. */
const renderManager = (props: ComponentProps<typeof ImageManager>) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return render(<ImageManager {...props} />, { wrapper: Wrapper });
};

const chooseFile = (testId: string) => {
  const input = document.querySelector(`input#${testId}`);

  if (!(input instanceof HTMLInputElement)) {
    throw new TypeError(`No upload input with id ${testId}`);
  }

  fireEvent.change(input, {
    target: {
      files: [new File(["original"], "icon.png", { type: "image/png" })],
    },
  });
};

describe(ImageManager, () => {
  beforeEach(() => {
    onChange.mockReset();
    deleteProjectImageMock.mockReset().mockResolvedValue();
    storageIsConfiguredMock.mockReset().mockResolvedValue(true);
    toastDismissMock.mockReset();
    toastErrorMock.mockReset();
    uploadProjectImageMock.mockReset().mockResolvedValue(uploaded);
  });

  it("frames an icon before uploading it", async () => {
    renderManager({
      onChange,
      icon: null,
      kind: PROJECT_IMAGE_KIND.icon,
      projectId: "project-1",
      projectName: "Example",
    });

    chooseFile("project-icon-upload");

    expect(
      screen.getByRole("dialog", { name: "Image cropper" })
    ).toBeInTheDocument();
    expect(uploadProjectImageMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Confirm crop" }));

    await waitFor(() => expect(uploadProjectImageMock).toHaveBeenCalledOnce());
    expect(uploadProjectImageMock.mock.calls[0][0]).toMatchObject({
      file: expect.objectContaining({ name: "cropped.webp" }),
      kind: "icon",
      projectId: "project-1",
    });
    expect(onChange).toHaveBeenCalledWith({
      icon: {
        height: 512,
        id: "image-1",
        url: "/api/project-image/image-1",
        width: 512,
      },
    });
  });

  it("discards the framing when the creator cancels", () => {
    renderManager({
      onChange,
      icon: null,
      kind: PROJECT_IMAGE_KIND.icon,
      projectId: "project-1",
      projectName: "Example",
    });

    chooseFile("project-icon-upload");
    fireEvent.click(screen.getByRole("button", { name: "Cancel crop" }));

    expect(screen.queryByRole("dialog", { name: "Image cropper" })).toBeNull();
    expect(uploadProjectImageMock).not.toHaveBeenCalled();
  });

  it("uploads gallery images directly, without a crop dialog", async () => {
    renderManager({
      onChange,
      gallery: [],
      kind: PROJECT_IMAGE_KIND.gallery,
      projectId: "project-1",
      projectName: "Example",
    });

    chooseFile("project-gallery-upload");

    expect(screen.queryByRole("dialog", { name: "Image cropper" })).toBeNull();
    await waitFor(() => expect(uploadProjectImageMock).toHaveBeenCalledOnce());
    expect(uploadProjectImageMock.mock.calls[0][0]).toMatchObject({
      file: expect.objectContaining({ name: "icon.png" }),
      kind: "gallery",
    });
  });
});
