import { afterEach, describe, expect, it, vi } from "vitest";

import {
  isAcceptedAvatarType,
  readAvatarDimensions,
} from "@/lib/avatar-upload";

const imageFile = (type = "image/png"): File =>
  new File([new Uint8Array([0])], "avatar.png", { type });

describe("avatar upload helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe(isAcceptedAvatarType, () => {
    it("accepts the four formats the server sniffs", () => {
      for (const type of [
        "image/gif",
        "image/jpeg",
        "image/png",
        "image/webp",
      ]) {
        expect(isAcceptedAvatarType(type)).toBeTruthy();
      }
    });

    it("refuses anything else, including SVG", () => {
      expect(isAcceptedAvatarType("image/svg+xml")).toBeFalsy();
      expect(isAcceptedAvatarType("")).toBeFalsy();
      expect(isAcceptedAvatarType(null)).toBeFalsy();
    });
  });

  describe(readAvatarDimensions, () => {
    it("returns null for a type the pipeline does not accept", async () => {
      const decode = vi.fn<() => void>();
      vi.stubGlobal("createImageBitmap", decode);

      await expect(
        readAvatarDimensions(imageFile("image/svg+xml"))
      ).resolves.toBeNull();
      expect(decode).not.toHaveBeenCalled();
    });

    it("reads the size from createImageBitmap", async () => {
      const close = vi.fn<() => void>();
      vi.stubGlobal(
        "createImageBitmap",
        vi
          .fn<
            () => Promise<{ close: () => void; height: number; width: number }>
          >()
          .mockResolvedValue({ close, height: 320, width: 240 })
      );

      await expect(readAvatarDimensions(imageFile())).resolves.toStrictEqual({
        height: 320,
        width: 240,
      });
      expect(close).toHaveBeenCalledOnce();
    });

    it("falls back to an <img> when the bitmap decoder rejects", async () => {
      vi.stubGlobal(
        "createImageBitmap",
        vi
          .fn<() => Promise<never>>()
          .mockRejectedValue(new Error("unsupported"))
      );
      vi.stubGlobal("URL", {
        ...URL,
        createObjectURL: vi.fn<() => string>(() => "blob:avatar"),
        revokeObjectURL: vi.fn<() => void>(),
      });
      Object.defineProperty(HTMLImageElement.prototype, "decode", {
        configurable: true,
        value: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
      });
      Object.defineProperty(HTMLImageElement.prototype, "naturalWidth", {
        configurable: true,
        value: 128,
      });
      Object.defineProperty(HTMLImageElement.prototype, "naturalHeight", {
        configurable: true,
        value: 256,
      });

      await expect(readAvatarDimensions(imageFile())).resolves.toStrictEqual({
        height: 256,
        width: 128,
      });
    });

    it("returns null rather than rejecting when decoding fails entirely", async () => {
      vi.stubGlobal(
        "createImageBitmap",
        vi
          .fn<() => Promise<never>>()
          .mockRejectedValue(new Error("unsupported"))
      );
      vi.stubGlobal("URL", {
        ...URL,
        createObjectURL: vi.fn<() => string>(() => {
          throw new Error("no object URLs here");
        }),
      });

      await expect(readAvatarDimensions(imageFile())).resolves.toBeNull();
    });
  });
});
