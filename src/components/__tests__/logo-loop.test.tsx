import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LogoLoop } from "@/components/logo-loop";
import type { LogoItem } from "@/components/logo-loop";

const LOGOS: LogoItem[] = [
  { href: "https://react.dev", node: <span>React</span>, title: "React" },
  {
    href: "https://tanstack.com",
    node: <span>TanStack</span>,
    title: "TanStack",
  },
  { node: <span>Unlinked</span>, title: "Unlinked" },
];

const REGION_NAME = /technologies voxelvein/iu;

const renderLoop = (props: Partial<Parameters<typeof LogoLoop>[0]> = {}) =>
  render(
    <LogoLoop
      ariaLabel="Technologies VoxelVein is built on"
      logos={LOGOS}
      {...props}
    />
  );

const regionOf = () => screen.getByRole("region", { name: REGION_NAME });

/** The first copy is the only one exposed; the rest are duplicates. */
const liveCopyOf = (region: HTMLElement) => region.querySelectorAll("ul")[0];

/**
 * `usePrefersReducedMotion` caches its `MediaQueryList` at module scope, so
 * `matches` has to read a mutable flag instead of a per-test literal.
 */
let prefersReducedMotion = false;

describe(LogoLoop, () => {
  // jsdom has no matchMedia; the loop checks reduced motion before animating.
  // jsdom has no ResizeObserver either, and reports every box as 0x0, so the
  // sequence never measures and the loop keeps its minimum copy count.
  beforeEach(() => {
    prefersReducedMotion = false;
    vi.stubGlobal(
      "matchMedia",
      vi.fn<
        (
          query: string
        ) => Pick<
          MediaQueryList,
          "addEventListener" | "matches" | "removeEventListener"
        >
      >((query) => ({
        addEventListener: vi.fn<MediaQueryList["addEventListener"]>(),
        get matches() {
          return (
            query.includes("prefers-reduced-motion") && prefersReducedMotion
          );
        },
        removeEventListener: vi.fn<MediaQueryList["removeEventListener"]>(),
      }))
    );
    vi.stubGlobal(
      "ResizeObserver",
      class {
        disconnect = vi.fn<() => void>();
        observe = vi.fn<() => void>();
      }
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("exposes the loop as a region named by the caller", () => {
    renderLoop();

    expect(regionOf()).toBeInTheDocument();
  });

  it("names every linked logo after the product it represents", () => {
    renderLoop();

    const links = within(liveCopyOf(regionOf())).getAllByRole("link");

    expect(links.map((link) => link.getAttribute("aria-label"))).toStrictEqual([
      "React",
      "TanStack",
    ]);
    expect(links.map((link) => link.getAttribute("href"))).toStrictEqual([
      "https://react.dev",
      "https://tanstack.com",
    ]);
    expect(
      links.every((link) => link.getAttribute("rel") === "noopener noreferrer")
    ).toBeTruthy();
  });

  it("keeps duplicate copies out of the tab order", () => {
    renderLoop();

    const copies = regionOf().querySelectorAll("ul");

    // Two copies is the minimum that makes the wrap seamless. Without a
    // measurable sequence there is nothing to compute a higher count from.
    expect(copies).toHaveLength(2);
    expect(copies[0].hasAttribute("inert")).toBeFalsy();
    expect(copies[1].hasAttribute("inert")).toBeTruthy();
  });

  it("hides a linked graphic, since its link already names it", () => {
    renderLoop();

    const link = within(liveCopyOf(regionOf())).getByRole("link", {
      name: "React",
    });

    expect(link.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });

  it("leaves an unlinked graphic exposed, since nothing else names it", () => {
    renderLoop({ logos: [{ node: <span>Unlinked</span>, title: "Unlinked" }] });

    const item = within(liveCopyOf(regionOf())).getByRole("listitem");

    expect(item.firstElementChild).not.toHaveAttribute("aria-hidden");
    expect(item.firstElementChild).toHaveAttribute("title", "Unlinked");
  });

  it("swaps the animation for a scrollbar when the user prefers reduced motion", () => {
    prefersReducedMotion = true;
    renderLoop();

    const region = regionOf();
    const copies = region.querySelectorAll("ul");

    // A single copy, because the duplicates a scrolling loop needs are inert
    // and would strand most logos out of reach.
    expect(copies).toHaveLength(1);
    expect(copies[0].hasAttribute("inert")).toBeFalsy();
    expect(region).toHaveClass("overflow-x-auto");
  });

  it("eases down to the hover speed without coming to a stop", () => {
    // A sequence far wider than the distances measured below, so
    // `normalizeOffset` cannot wrap mid-window and turn a displacement into a
    // negative difference.
    vi.spyOn(
      HTMLUListElement.prototype,
      "getBoundingClientRect"
    ).mockReturnValue({
      bottom: 0,
      height: 0,
      left: 0,
      right: 0,
      toJSON: () => ({}),
      top: 0,
      width: 100_000,
      x: 0,
      y: 0,
    });
    vi.useFakeTimers();

    const { unmount } = renderLoop({ hoverSpeed: 15, speed: 50 });
    const track = liveCopyOf(regionOf()).parentElement;
    if (!(track instanceof HTMLElement)) {
      throw new Error("the track should wrap the sequence");
    }

    /** How far the track has travelled, negated so it counts up. */
    const travelled = () => {
      const match = /translate3d\((?<offset>-?[\d.]+)px/u.exec(
        track.style.transform
      );
      return Number(match?.groups?.offset ?? Number.NaN) * -1;
    };

    // Measure a window once the velocity has settled, both cruising and
    // hovered, since the loop eases rather than steps to a new speed.
    vi.advanceTimersByTime(1000);
    const from = travelled();
    vi.advanceTimersByTime(1000);
    const cruising = travelled() - from;

    fireEvent.mouseEnter(track);
    vi.advanceTimersByTime(1000);
    const hoverFrom = travelled();
    vi.advanceTimersByTime(1000);
    const hovered = travelled() - hoverFrom;

    // The loop has to be genuinely moving for either reading to mean anything.
    expect(cruising).toBeGreaterThan(1);

    // Velocity eases towards its target rather than reaching it, so a full stop
    // decays to a small non-zero crawl rather than to nothing. Comparing the
    // ratio is what separates a deliberate slowdown from that tail: 15/50
    // settles near 0.3, whereas a stop lands below 0.01.
    const ratio = hovered / cruising;
    expect(ratio).toBeGreaterThan(0.2);
    expect(ratio).toBeLessThan(0.45);

    unmount();
    vi.useRealTimers();
  });

  it("lets a caller replace the item markup entirely", () => {
    renderLoop({ renderItem: (item) => <span>{item.title}</span> });

    const copy = liveCopyOf(regionOf());

    expect(within(copy).queryAllByRole("link")).toHaveLength(0);
    expect(within(copy).getAllByText(/react|tanstack|unlinked/iu)).toHaveLength(
      3
    );
  });

  it("still labels the region when there are no logos to loop", () => {
    renderLoop({ logos: [] });

    expect(within(regionOf()).queryAllByRole("link")).toHaveLength(0);
  });
});
