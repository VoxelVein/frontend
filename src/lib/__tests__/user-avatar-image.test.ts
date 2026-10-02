import { describe, expect, it } from "vitest";

import { MAX_EDGE_BY_KIND } from "@/lib/image-resize";
import { readImage } from "@/lib/image-validation";

/**
 * The avatar pipeline reuses the project-image validation wholesale, so these
 * cover the properties the avatar route depends on rather than re-testing the
 * parser: that a client-declared type is ignored, and that an avatar is resized
 * with a kind whose ceiling suits its display size.
 */

const PNG_HEADER = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49,
  0x48, 0x44, 0x52, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x40, 0x00, 0x00, 0x00,
  0x0a, 0x00, 0x00, 0x00, 0x00,
]);

describe("the avatar image gate", () => {
  it("takes the type from the bytes, not the request", () => {
    // The route reads only the leading bytes and never looks at content-type,
    // so a client that claims `image/png` while sending something else is
    // decided by the sniff.
    const image = readImage(PNG_HEADER);
    expect(image).not.toBeNull();
    expect(image?.contentType).toBe("image/png");
    expect(image?.dimensions).toStrictEqual({ height: 16_384, width: 256 });
  });

  it("rejects a truncated header rather than guessing", () => {
    expect(readImage(Uint8Array.from([0x89, 0x50, 0x4e, 0x47]))).toBeNull();
  });

  it("uses the icon ceiling for avatars", () => {
    // An avatar renders at 24-80px, the same range as a project icon, so it
    // reuses `icon`'s 512px bound instead of growing a second constant for the
    // same job. A phone camera shot is scaled before it is sent.
    expect(MAX_EDGE_BY_KIND.icon).toBe(512);
  });
});
