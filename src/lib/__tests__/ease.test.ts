import { describe, expect, it } from "vitest";

import { cubicBezier, springEasingCss } from "@/lib/ease";

const LINEAR_STOPS = /^linear\((?<stops>.+)\)$/u;

describe(cubicBezier, () => {
  it("starts at 0, ends at 1 and eases out", () => {
    const ease = cubicBezier(0.22, 1, 0.36, 1);

    expect(ease(0)).toBeCloseTo(0);
    expect(ease(1)).toBeCloseTo(1);
    expect(ease(0.5)).toBeGreaterThan(0.5);
  });

  it("is the identity for a linear curve", () => {
    const ease = cubicBezier(0, 0, 1, 1);

    expect(ease(0.3)).toBeCloseTo(0.3);
  });
});

describe(springEasingCss, () => {
  it("builds a linear() curve from 0 to 1", () => {
    const css = springEasingCss({
      damping: 30,
      durationMs: 400,
      stiffness: 400,
    });
    const stops = LINEAR_STOPS.exec(css)?.groups?.stops.split(", ").map(Number);

    expect(stops?.[0]).toBe(0);
    expect(stops?.at(-1)).toBe(1);
  });

  it("overshoots slightly for an underdamped spring", () => {
    const css = springEasingCss({
      damping: 30,
      durationMs: 400,
      stiffness: 400,
    });
    const stops =
      LINEAR_STOPS.exec(css)?.groups?.stops.split(", ").map(Number) ?? [];

    expect(Math.max(...stops)).toBeGreaterThan(1);
    expect(Math.max(...stops)).toBeLessThan(1.05);
  });
});
