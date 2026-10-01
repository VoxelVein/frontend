import { describe, expect, it } from "vitest";

import {
  MAX_EDGE_BY_KIND,
  needsResize,
  outputTypeFor,
  scaledSize,
} from "@/lib/image-resize";

describe(scaledSize, () => {
  it("scales a large landscape photo down to the target edge", () => {
    // 4000x3000 into a 1920 gallery: longest edge lands exactly on target.
    expect(scaledSize("gallery", { height: 3000, width: 4000 })).toStrictEqual({
      height: 1440,
      width: 1920,
    });
  });

  it("scales a portrait by its longest edge, not its width", () => {
    expect(scaledSize("gallery", { height: 4000, width: 3000 })).toStrictEqual({
      height: 1920,
      width: 1440,
    });
  });

  it("leaves an already-small image exactly as it is", () => {
    const original = { height: 300, width: 400 };
    expect(scaledSize("icon", original)).toStrictEqual(original);
  });

  it("never upscales", () => {
    // A 64px icon is already far below the 512 cap; enlarging it would waste
    // bytes and add nothing.
    const tiny = { height: 32, width: 32 };
    expect(scaledSize("icon", tiny)).toStrictEqual(tiny);
  });

  it("keeps an image on its own limit at exactly the target", () => {
    expect(scaledSize("gallery", { height: 1080, width: 1920 })).toStrictEqual({
      height: 1080,
      width: 1920,
    });
  });

  it("never collapses a very thin strip to zero", () => {
    const thin = scaledSize("icon", { height: 1, width: 8000 });
    expect(thin.width).toBeGreaterThan(0);
    expect(thin.height).toBeGreaterThan(0);
  });

  it("gives icons a much tighter budget than gallery images", () => {
    expect(MAX_EDGE_BY_KIND.icon).toBeLessThan(MAX_EDGE_BY_KIND.gallery);
  });
});

describe(needsResize, () => {
  it("wants to shrink a photo far past the target", () => {
    expect(
      needsResize("gallery", {
        height: 3000,
        type: "image/jpeg",
        width: 4000,
      })
    ).toBeTruthy();
  });

  it("leaves a small image alone rather than re-encoding it", () => {
    // Re-encoding a 200px icon costs quality and bytes for no saving.
    expect(
      needsResize("icon", { height: 100, type: "image/png", width: 200 })
    ).toBeFalsy();
  });

  it("never resizes a GIF, which would drop the animation", () => {
    expect(
      needsResize("gallery", {
        height: 4000,
        type: "image/gif",
        width: 4000,
      })
    ).toBeFalsy();
  });

  it("still shrinks a PNG, because icons need it too", () => {
    expect(
      needsResize("icon", { height: 4000, type: "image/png", width: 4000 })
    ).toBeTruthy();
  });
});

describe(outputTypeFor, () => {
  it("keeps PNG so a transparent icon stays transparent", () => {
    expect(outputTypeFor("image/png")).toBe("image/png");
  });

  it("re-encodes a photo as WebP, which is much smaller", () => {
    expect(outputTypeFor("image/jpeg")).toBe("image/webp");
  });

  it("only ever emits a type the server accepts", () => {
    // The route sniffs the bytes and allows exactly these four.
    for (const source of ["image/png", "image/jpeg", "image/webp"]) {
      expect(["image/png", "image/webp"]).toContain(outputTypeFor(source));
    }
  });
});
