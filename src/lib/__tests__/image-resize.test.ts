import { describe, expect, it } from "vitest";

import {
  MAX_EDGE_BY_KIND,
  centerCropOffset,
  clampCropOffset,
  cropZoomBounds,
  needsResize,
  outputTypeFor,
  scaledSize,
  sourceCrop,
  zoomCropView,
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

describe(sourceCrop, () => {
  it("frames a square crop the size of the crop window at zero zoom", () => {
    // Zoom 1 means the window is the source: a full square, no more.
    expect(sourceCrop(1, 256, { x: 0, y: 0 })).toStrictEqual({
      height: 256,
      width: 256,
      x: 0,
      y: 0,
    });
  });

  it("scales the square window down to the source at any zoom", () => {
    expect(sourceCrop(2, 256, { x: 0, y: 0 })).toStrictEqual({
      height: 128,
      width: 128,
      x: 0,
      y: 0,
    });
  });

  it("divides the pan offset out of the source crop like the window was scaled", () => {
    expect(sourceCrop(2, 256, { x: 64, y: 32 })).toStrictEqual({
      height: 128,
      width: 128,
      x: 32,
      y: 16,
    });
  });
});

describe(clampCropOffset, () => {
  it("allows the square window to sit anywhere inside a square source", () => {
    expect(
      clampCropOffset(1, 256, { x: 10, y: 20 }, { height: 512, width: 512 })
    ).toStrictEqual({
      x: 10,
      y: 20,
    });
  });

  it("pins a window that overflows the source back to a full square", () => {
    // At this zoom the square cannot fill the source, so the window is pinned
    // at the origin rather than allowed to expose empty space.
    expect(
      clampCropOffset(
        0.25,
        256,
        { x: 10_000, y: 10_000 },
        { height: 1000, width: 1000 }
      )
    ).toStrictEqual({
      x: 0,
      y: 0,
    });
  });

  it("clamps a pan that runs past the end of a fully covered source", () => {
    expect(
      clampCropOffset(
        0.5,
        256,
        { x: 300, y: 100 },
        { height: 1000, width: 1000 }
      )
    ).toStrictEqual({
      x: 244,
      y: 100,
    });
  });
});

describe(cropZoomBounds, () => {
  it("fits the shorter edge to the window and never exposes empty space", () => {
    // A 2000x1000 photo must at least fill a 256px window by its short edge.
    expect(cropZoomBounds({ height: 1000, width: 2000 })).toStrictEqual({
      max: 2.048,
      min: 0.256,
    });
  });

  it("derives from the source size, so every image is accepted", () => {
    // A huge panorama and a tiny icon both get a usable, proportional range.
    const huge = cropZoomBounds({ height: 100, width: 20_000 });
    const tiny = cropZoomBounds({ height: 16, width: 16 });

    expect(huge.min).toBeCloseTo(2.56);
    expect(huge.max).toBeCloseTo(20.48);
    expect(tiny.min).toBe(16);
    expect(tiny.max).toBe(128);
  });
});

describe(centerCropOffset, () => {
  it("centres the fitted image, leaving no offset on the tight axis", () => {
    expect(
      centerCropOffset(0.256, 256, { height: 1000, width: 2000 })
    ).toStrictEqual({
      x: 128,
      y: 0,
    });
  });
});

describe(zoomCropView, () => {
  it("keeps the same image point under the window centre", () => {
    expect(
      zoomCropView({ offset: { x: 128, y: 0 }, zoom: 0.256 }, 0.512, 256, {
        height: 1000,
        width: 2000,
      })
    ).toStrictEqual({
      offset: { x: 384, y: 128 },
      zoom: 0.512,
    });
  });

  it("returns to the original framing after zooming in and back out", () => {
    const original = { offset: { x: 128, y: 0 }, zoom: 0.256 };

    const zoomedIn = zoomCropView(original, 0.512, 256, {
      height: 1000,
      width: 2000,
    });

    const zoomedOut = zoomCropView(zoomedIn, 0.256, 256, {
      height: 1000,
      width: 2000,
    });

    expect(zoomedOut.offset.x).toBeCloseTo(original.offset.x);
    expect(zoomedOut.offset.y).toBeCloseTo(original.offset.y);
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
