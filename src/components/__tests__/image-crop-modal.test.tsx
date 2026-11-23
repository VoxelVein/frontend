import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ImageCropModal } from "@/components/image-crop-modal";

const { renderBlobMock } = vi.hoisted(() => ({
  renderBlobMock:
    vi.fn<
      (
        image: HTMLImageElement,
        crop: { height: number; width: number; x: number; y: number },
        size: number,
        type: string,
        quality: number
      ) => Promise<Blob | null>
    >(),
}));

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- Canvas has no encoder in jsdom; only the framing handed to the encoder is under test
vi.mock("@/lib/image-resize", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/image-resize")>()),
  renderImageToBlob: renderBlobMock,
}));

const sourceFile = () =>
  new File(["original"], "logo.png", { type: "image/png" });

const renderModal = (onConfirm: (file: File) => void) =>
  render(
    <ImageCropModal
      areaLabel="Icon crop area"
      confirmLabel="Save icon"
      description="Frame the icon."
      file={sourceFile()}
      onCancel={vi.fn<() => void>()}
      onConfirm={onConfirm}
      outputName="project-icon.webp"
      title="Crop your icon"
    />
  );

describe(ImageCropModal, () => {
  beforeEach(() => {
    renderBlobMock
      .mockReset()
      .mockResolvedValue(new Blob(["encoded"], { type: "image/webp" }));

    // jsdom does not decode images or know their intrinsic size.
    Object.defineProperty(HTMLImageElement.prototype, "decode", {
      configurable: true,
      value: () => Promise.resolve(),
    });
    Object.defineProperty(HTMLImageElement.prototype, "naturalWidth", {
      configurable: true,
      get: () => 1024,
    });
    Object.defineProperty(HTMLImageElement.prototype, "naturalHeight", {
      configurable: true,
      get: () => 768,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("hands the framed square to the encoder and returns a square image", async () => {
    const onConfirm = vi.fn<(file: File) => void>();
    renderModal(onConfirm);

    const save = await screen.findByRole("button", { name: "Save icon" });
    fireEvent.click(save);

    await waitFor(() => expect(onConfirm).toHaveBeenCalledOnce());

    // The shorter edge fills the 256px window, so a 1024x768 source starts
    // with a centred 768px square crop.
    expect(renderBlobMock).toHaveBeenCalledOnce();
    const [call] = renderBlobMock.mock.calls;
    expect(call[1]).toMatchObject({
      height: expect.closeTo(768),
      width: expect.closeTo(768),
      x: expect.closeTo(128),
      y: expect.closeTo(0),
    });
    expect([call[2], call[3]]).toStrictEqual([512, "image/webp"]);
    const [[file]] = onConfirm.mock.calls;
    expect(file.name).toBe("project-icon.webp");
  });

  it("zooms in with the wheel so the crop covers fewer source pixels", async () => {
    const onConfirm = vi.fn<(file: File) => void>();
    renderModal(onConfirm);

    const area = await screen.findByLabelText("Icon crop area");
    // jsdom's WheelEvent drops deltaY, so hand the listener a real value.
    const wheel = new Event("wheel", { bubbles: true, cancelable: true });
    Object.defineProperty(wheel, "deltaY", { value: -100 });
    act(() => {
      area.dispatchEvent(wheel);
    });
    fireEvent.click(screen.getByRole("button", { name: "Save icon" }));

    await waitFor(() => expect(onConfirm).toHaveBeenCalledOnce());

    const [[, crop]] = renderBlobMock.mock.calls;
    expect(crop.width).toBeLessThan(768);
    expect(crop.height).toBe(crop.width);
  });

  it("reports a failed encode instead of uploading a broken image", async () => {
    renderBlobMock.mockResolvedValue(null);
    const onConfirm = vi.fn<(file: File) => void>();
    renderModal(onConfirm);

    fireEvent.click(await screen.findByRole("button", { name: "Save icon" }));

    await expect(screen.findByRole("alert")).resolves.toHaveTextContent(
      "could not be prepared"
    );
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
