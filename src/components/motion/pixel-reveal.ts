// Pixel reveal for view transitions, after React Bits' PixelSwap
// (reactbits.dev/animations/pixel-swap). PixelSwap clones its content into
// every pixel, which does not scale to a whole page, so this keeps its grid
// and timing and instead masks the ::view-transition-new(root) snapshot with
// one mask layer per pixel, updated every frame.

import { cubicBezier } from "@/lib/ease";

interface PixelRevealOptions {
  /** Total length of the reveal. */
  duration: number;
  /** Fade each pixel in while it grows. */
  fade: boolean;
  /** How long a single pixel takes to grow in. */
  pixelDuration: number;
  /** Starting scale of each pixel, relative to its cell. */
  pixelScale: number;
  /** Requested cell size; grows when the viewport would need too many cells. */
  pixelSize: number;
}

/**
 * PixelSwap demo preset (64px pixels, random order, fade), sped up from its
 * 1.4s / 450ms timing, which felt sluggish for a theme switch.
 */
export const PIXEL_SWAP_PRESET: PixelRevealOptions = {
  duration: 600,
  fade: true,
  pixelDuration: 250,
  pixelScale: 0.35,
  pixelSize: 64,
};

// PixelSwap's defaults: its cap on grid cells and its easing curve.
const MAX_PIXELS = 220;
const PIXEL_EASE = cubicBezier(0.22, 1, 0.36, 1);
// A pixel is fully opaque once it is this far through its eased growth.
const FADE_GAIN = 1.6;
// Grown pixels overlap by a pixel so no hairline seams show between them.
const SEAM_OVERLAP_PX = 1;
const MIN_DURATION_MS = 200;
const MIN_PIXEL_DURATION_MS = 60;

interface PixelCell {
  left: number;
  /** 0–1: when this cell starts, as a share of the stagger window. */
  offset: number;
  top: number;
}

interface PixelGrid {
  cells: PixelCell[];
  size: number;
}

export interface PixelMaskFrame {
  maskImage: string;
  maskPosition?: string;
  maskSize?: string;
}

const HIDDEN_FRAME: PixelMaskFrame = {
  maskImage: "linear-gradient(transparent, transparent)",
};
const VISIBLE_FRAME: PixelMaskFrame = { maskImage: "none" };

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

// PixelSwap's deterministic hash; with the "random" pattern it is the order.
const noise = (seed: number): number => {
  const value = Math.sin(seed * 127.1 + 311.7) * 43_758.5453;
  return value - Math.floor(value);
};

const countCells = (width: number, height: number, size: number) => ({
  columns: Math.max(1, Math.ceil(width / size)),
  rows: Math.max(1, Math.ceil(height / size)),
});

/** Covers the box with square cells, centred, capped at MAX_PIXELS. */
export const buildPixelGrid = (
  width: number,
  height: number,
  pixelSize: number
): PixelGrid => {
  let size = Math.max(8, Math.round(pixelSize));
  let { columns, rows } = countCells(width, height, size);

  if (columns * rows > MAX_PIXELS) {
    size = Math.ceil(size * Math.sqrt((columns * rows) / MAX_PIXELS));
    ({ columns, rows } = countCells(width, height, size));
  }
  // Rounding each axis up can still overshoot the cap by a row or column.
  while (columns * rows > MAX_PIXELS) {
    size += 1;
    ({ columns, rows } = countCells(width, height, size));
  }

  const originX = (width - columns * size) / 2;
  const originY = (height - rows * size) / 2;
  const cells: PixelCell[] = [];

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      cells.push({
        left: originX + column * size,
        offset: noise(row * columns + column + 1),
        top: originY + row * size,
      });
    }
  }

  return { cells, size };
};

const round = (value: number) => Math.round(value * 100) / 100;

/** Mask for the incoming snapshot `elapsed` ms into the reveal. */
export const pixelRevealFrame = (
  grid: PixelGrid,
  elapsed: number,
  options: PixelRevealOptions
): PixelMaskFrame => {
  const total = Math.max(MIN_DURATION_MS, options.duration);
  const pixelMs = clamp(options.pixelDuration, MIN_PIXEL_DURATION_MS, total);
  const spread = total - pixelMs;
  const startScale = clamp(options.pixelScale, 0.05, 1);
  const fullSide = grid.size + SEAM_OVERLAP_PX;

  const images: string[] = [];
  const positions: string[] = [];
  const sizes: string[] = [];

  for (const cell of grid.cells) {
    const progress = clamp((elapsed - cell.offset * spread) / pixelMs, 0, 1);
    if (progress === 0) {
      continue;
    }
    const eased = PIXEL_EASE(progress);
    const alpha = options.fade ? Math.min(1, eased * FADE_GAIN) : 1;
    const side = fullSide * (startScale + (1 - startScale) * eased);
    const inset = (grid.size - side) / 2;
    const color = `rgb(0 0 0 / ${round(alpha)})`;

    images.push(`linear-gradient(${color}, ${color})`);
    positions.push(
      `${round(cell.left + inset)}px ${round(cell.top + inset)}px`
    );
    sizes.push(`${round(side)}px ${round(side)}px`);
  }

  if (images.length === 0) {
    return HIDDEN_FRAME;
  }
  return {
    maskImage: images.join(", "),
    maskPosition: positions.join(", "),
    maskSize: sizes.join(", "),
  };
};

interface RevealTransition {
  ready: Promise<void>;
}

/**
 * Reveals the new snapshot of a running view transition pixel by pixel. The
 * transition stays open for as long as this animation runs. Resolves when the
 * reveal ends; a skipped transition resolves immediately.
 */
export const playPixelReveal = async (
  transition: RevealTransition,
  options: PixelRevealOptions = PIXEL_SWAP_PRESET
): Promise<void> => {
  try {
    await transition.ready;
  } catch {
    return;
  }

  const total = Math.max(MIN_DURATION_MS, options.duration);
  const grid = buildPixelGrid(
    window.innerWidth,
    window.innerHeight,
    options.pixelSize
  );
  const animation = document.documentElement.animate(
    [{ ...HIDDEN_FRAME }, { ...HIDDEN_FRAME }],
    {
      duration: total,
      fill: "forwards",
      pseudoElement: "::view-transition-new(root)",
    }
  );
  const { effect } = animation;
  if (!(effect instanceof KeyframeEffect)) {
    return;
  }

  // The animation only keeps the transition open for `total` ms; the frames
  // themselves are swapped in from requestAnimationFrame.
  const start = performance.now();
  const tick = (now: number) => {
    const elapsed = now - start;
    const frame =
      elapsed >= total
        ? VISIBLE_FRAME
        : pixelRevealFrame(grid, elapsed, options);
    effect.setKeyframes([{ ...frame }, { ...frame }]);
    if (elapsed < total) {
      requestAnimationFrame(tick);
    }
  };
  requestAnimationFrame(tick);

  try {
    await animation.finished;
  } catch {
    // Cancelled, e.g. the transition was skipped; nothing to clean up.
  }
};
