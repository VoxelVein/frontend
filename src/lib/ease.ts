/** CSS string form of the EASE_OUT curve for inline style transitions. */
export const EASE_OUT_CSS = "cubic-bezier(0.16, 1, 0.3, 1)";

const NEWTON_ITERATIONS = 5;

/**
 * JS form of a CSS `cubic-bezier()` timing function, for animations driven
 * frame by frame rather than by CSS. Maps linear progress (0–1) to eased
 * progress.
 */
export const cubicBezier = (
  x1: number,
  y1: number,
  x2: number,
  y2: number
): ((progress: number) => number) => {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;

  return (progress) => {
    // Solve x(t) = progress for t with Newton's method, then return y(t).
    let t = progress;
    for (let step = 0; step < NEWTON_ITERATIONS; step += 1) {
      const slope = (3 * ax * t + 2 * bx) * t + cx;
      if (slope === 0) {
        break;
      }
      t -= (((ax * t + bx) * t + cx) * t - progress) / slope;
    }
    t = Math.min(Math.max(t, 0), 1);
    return ((ay * t + by) * t + cy) * t;
  };
};

interface SpringOptions {
  damping: number;
  /** Length of the CSS transition the curve is stretched over. */
  durationMs: number;
  mass?: number;
  stiffness: number;
}

const SPRING_SAMPLES = 24;
const MS_PER_SECOND = 1000;

/**
 * CSS `linear()` timing function that follows a damped spring, so plain CSS
 * transitions can match motion-library spring presets. Only underdamped and
 * critically damped springs are supported; pick a duration long enough for
 * the spring to settle, since the last sample is pinned to 1.
 */
export const springEasingCss = ({
  damping,
  durationMs,
  mass = 1,
  stiffness,
}: SpringOptions): string => {
  const omega = Math.sqrt(stiffness / mass);
  const zeta = Math.min(damping / (2 * Math.sqrt(stiffness * mass)), 1);
  const dampedOmega = omega * Math.sqrt(1 - zeta * zeta);

  const position = (seconds: number): number => {
    const decay = Math.exp(-zeta * omega * seconds);
    if (dampedOmega === 0) {
      return 1 - decay * (1 + omega * seconds);
    }
    return (
      1 -
      decay *
        (Math.cos(dampedOmega * seconds) +
          ((zeta * omega) / dampedOmega) * Math.sin(dampedOmega * seconds))
    );
  };

  const stops: string[] = [];
  for (let sample = 0; sample < SPRING_SAMPLES; sample += 1) {
    const seconds = (sample / SPRING_SAMPLES) * (durationMs / MS_PER_SECOND);
    stops.push(position(seconds).toFixed(4));
  }
  stops.push("1");
  return `linear(${stops.join(", ")})`;
};
