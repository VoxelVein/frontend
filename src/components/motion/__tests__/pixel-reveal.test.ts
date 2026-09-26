import { describe, expect, it } from "vitest";

import {
  buildPixelGrid,
  PIXEL_SWAP_PRESET,
  pixelRevealFrame,
} from "@/components/motion/pixel-reveal";

const layerCount = (value: string | undefined) =>
  value ? value.split("px, ").length : 0;

describe(buildPixelGrid, () => {
  it("covers the box with square cells", () => {
    const grid = buildPixelGrid(640, 320, 64);

    expect(grid.size).toBe(64);
    expect(grid.cells).toHaveLength(50);
  });

  it("grows the cells when the box would need too many", () => {
    const grid = buildPixelGrid(1920, 1080, 64);

    expect(grid.size).toBeGreaterThan(64);
    expect(grid.cells.length).toBeLessThanOrEqual(220);
    expect(grid.cells.length * grid.size ** 2).toBeGreaterThanOrEqual(
      1920 * 1080
    );
  });
});

describe(pixelRevealFrame, () => {
  const grid = buildPixelGrid(640, 320, 64);

  it("hides the new snapshot before any pixel starts", () => {
    const frame = pixelRevealFrame(grid, 0, PIXEL_SWAP_PRESET);

    expect(frame.maskImage).toBe("linear-gradient(transparent, transparent)");
    expect(frame.maskSize).toBeUndefined();
  });

  it("reveals only some pixels halfway through", () => {
    const frame = pixelRevealFrame(
      grid,
      PIXEL_SWAP_PRESET.duration / 2,
      PIXEL_SWAP_PRESET
    );
    const layers = layerCount(frame.maskSize);

    expect(layers).toBeGreaterThan(0);
    expect(layers).toBeLessThan(grid.cells.length);
  });

  it("shows every pixel fully grown and opaque at the end", () => {
    const frame = pixelRevealFrame(
      grid,
      PIXEL_SWAP_PRESET.duration,
      PIXEL_SWAP_PRESET
    );

    expect(layerCount(frame.maskSize)).toBe(grid.cells.length);
    expect(
      frame.maskSize?.split(", ").every((size) => size === "65px 65px")
    ).toBeTruthy();
    expect(frame.maskImage).not.toContain("/ 0.");
  });
});
