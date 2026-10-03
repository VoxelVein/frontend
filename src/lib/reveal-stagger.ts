/**
 * How far apart two items in a staggered row start, in seconds.
 *
 * Shared by every staggered grid rather than re-derived per call site: three
 * copies of a magic number is three chances for the landing page to stop
 * feeling like one page.
 *
 * Small on purpose. A grid can be five across, and a per-item delay large enough
 * to read on a single card becomes a noticeable wait on the last one — the row
 * appears to hang rather than arrive.
 */
const STAGGER_SECONDS = 0.05;

/**
 * The delay for item `index` of a staggered row, capped.
 *
 * The cap is what makes this safe on an unbounded list: without it the tenth
 * entry waits half a second and the fiftieth nearly three. Past the cap
 * everything lands together, which still reads as one group arriving.
 */
export const staggerDelay = (index: number, cap = 4): number =>
  Math.min(index, cap) * STAGGER_SECONDS;
