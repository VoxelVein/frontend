import { describe, expect, it } from "vitest";

import {
  imageFilename,
  isAllowedImageType,
  readImage,
  sniffImageType,
} from "@/lib/image-validation";

/** Minimal valid PNG header: signature, IHDR length/type, then dimensions. */
const pngBytes = (width: number, height: number) => {
  const bytes = new Uint8Array(33);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  bytes.set([0x00, 0x00, 0x00, 0x0d], 8);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes;
};

const gifBytes = (width: number, height: number) => {
  const bytes = new Uint8Array(13);
  bytes.set([0x47, 0x49, 0x46, 0x38, 0x39, 0x61], 0);
  const view = new DataView(bytes.buffer);
  view.setUint16(6, width, true);
  view.setUint16(8, height, true);
  return bytes;
};

const jpegBytes = (width: number, height: number) => {
  // SOI, then a start-of-frame segment carrying the dimensions.
  const bytes = new Uint8Array(21);
  bytes.set([0xff, 0xd8], 0);
  bytes.set([0xff, 0xc0], 2);
  const view = new DataView(bytes.buffer);
  // The segment length covers the marker byte through the dimensions.
  view.setUint16(4, 17);
  view.setUint16(7, height);
  view.setUint16(9, width);
  return bytes;
};

const webpBytes = (width: number, height: number) => {
  // "RIFF" .... "WEBP", then the chunk tag "VP8X".
  const bytes = new Uint8Array(32);
  bytes.set([0x52, 0x49, 0x46, 0x46], 0);
  bytes.set([0x57, 0x45, 0x42, 0x50], 8);
  bytes.set([0x56, 0x50, 0x38, 0x58], 12);
  // The VP8X header stores width-1 and height-1 as 24-bit little-endian
  // values. The dimensions a test uses are far below 65 536, so the two low
  // bytes carry the whole number and a 16-bit little-endian write leaves the
  // high byte of each field zero.
  const view = new DataView(bytes.buffer);
  view.setUint16(24, width - 1, true);
  view.setUint16(27, height - 1, true);
  return bytes;
};

describe(sniffImageType, () => {
  it("identifies each allowed format from its magic bytes", () => {
    expect(sniffImageType(pngBytes(4, 4))).toBe("image/png");
    expect(sniffImageType(jpegBytes(4, 4))).toBe("image/jpeg");
    expect(sniffImageType(gifBytes(4, 4))).toBe("image/gif");
    expect(sniffImageType(webpBytes(4, 4))).toBe("image/webp");
  });

  it("rejects a zip archive even though .jar uploads are allowed elsewhere", () => {
    expect(sniffImageType(new Uint8Array([0x50, 0x4b, 0x03, 0x04]))).toBeNull();
  });

  it("rejects an SVG, which could execute in the site's origin", () => {
    const svg = new TextEncoder().encode(
      '<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>'
    );
    expect(sniffImageType(svg)).toBeNull();
  });

  it("rejects an HTML document", () => {
    const html = new TextEncoder().encode("<!DOCTYPE html><script>");
    expect(sniffImageType(html)).toBeNull();
  });
});

describe(isAllowedImageType, () => {
  it("agrees with the sniffer", () => {
    expect(isAllowedImageType(pngBytes(1, 1))).toBeTruthy();
    expect(isAllowedImageType(new Uint8Array([0x00, 0x01]))).toBeFalsy();
  });
});

describe(readImage, () => {
  it("reads PNG dimensions", () => {
    expect(readImage(pngBytes(128, 64))).toStrictEqual({
      contentType: "image/png",
      dimensions: { height: 64, width: 128 },
      extension: "png",
    });
  });

  it("reads GIF dimensions as little-endian", () => {
    expect(readImage(gifBytes(300, 200))?.dimensions).toStrictEqual({
      height: 200,
      width: 300,
    });
  });

  it("reads JPEG dimensions from the frame header", () => {
    expect(readImage(jpegBytes(1920, 1080))?.dimensions).toStrictEqual({
      height: 1080,
      width: 1920,
    });
  });

  it("reads WebP dimensions from the extended header", () => {
    expect(readImage(webpBytes(256, 256))?.dimensions).toStrictEqual({
      height: 256,
      width: 256,
    });
  });

  it("returns null for a disallowed type", () => {
    expect(readImage(new Uint8Array([0x50, 0x4b, 0x03, 0x04]))).toBeNull();
  });

  it("returns null for a zero dimension", () => {
    expect(readImage(pngBytes(0, 100))).toBeNull();
  });

  it("returns null for an implausibly large dimension", () => {
    expect(readImage(pngBytes(99_999, 100))).toBeNull();
  });
});

describe(imageFilename, () => {
  it("derives the name from the id, kind, and sniffed extension", () => {
    expect(imageFilename("abc", "png", "icon")).toBe("icon-abc.png");
    expect(imageFilename("abc", "jpg", "gallery")).toBe("gallery-abc.jpg");
  });
});
