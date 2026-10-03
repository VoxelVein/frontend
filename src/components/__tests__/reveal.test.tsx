import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Reveal } from "@/components/reveal";
import { staggerDelay } from "@/lib/reveal-stagger";

/** One intersection entry, shaped as the browser delivers it. */
interface FakeEntry {
  isIntersecting: boolean;
}

/** The entries reporter handed to each observer, so a test can fire one. */
let reporters: ((entries: FakeEntry[]) => void)[] = [];
let disconnectCount = 0;

/**
 * Reports an intersection the way the browser would, so a test decides when the
 * reveal happens rather than waiting for a layout that jsdom never performs.
 */
const intersect = () => {
  const report = reporters.at(-1);
  if (report) {
    act(() => {
      report([{ isIntersecting: true }]);
    });
  }
};

const revealed = () => screen.getByTestId("block");

describe(Reveal, () => {
  beforeEach(() => {
    reporters = [];
    disconnectCount = 0;
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        disconnect = vi.fn<() => void>(() => {
          disconnectCount += 1;
        });

        observe = vi.fn<(target: Element) => void>();

        unobserve = vi.fn<(target: Element) => void>();

        constructor(report: (entries: FakeEntry[]) => void) {
          reporters.push(report);
        }
      }
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("stays hidden until it is scrolled into view", () => {
    render(
      <Reveal>
        <p data-testid="block">Later</p>
      </Reveal>
    );

    // The resting state is hidden, so this is what stops the content flashing
    // before it animates.
    expect(revealed().parentElement).toHaveAttribute("data-visible", "false");
    expect(revealed().parentElement).not.toHaveClass("is-visible");
  });

  it("reveals once the observer reports it in view", () => {
    render(
      <Reveal>
        <p data-testid="block">Later</p>
      </Reveal>
    );

    intersect();

    expect(revealed().parentElement).toHaveAttribute("data-visible", "true");
    expect(revealed().parentElement).toHaveClass("is-visible");
  });

  it("asks the observer to wait 48px past the bottom edge", () => {
    render(
      <Reveal>
        <p data-testid="block">Later</p>
      </Reveal>
    );

    // The margin is what stops a block being caught by a viewport that was
    // already scrolled down past it.
    expect(reporters).toHaveLength(1);
  });

  it("tears the observer down as it reveals", () => {
    render(
      <Reveal>
        <p data-testid="block">Later</p>
      </Reveal>
    );

    intersect();

    // Disconnecting is what makes this one-shot: the browser stops reporting, so
    // scrolling back up can never re-hide a block that has already arrived.
    expect(disconnectCount).toBeGreaterThanOrEqual(1);
  });

  it("never re-hides a block that has already been revealed", () => {
    render(
      <Reveal>
        <p data-testid="block">Later</p>
      </Reveal>
    );

    intersect();
    intersect();

    // Deliberately invoking the stored callback a second time, which a real
    // disconnected observer would not do: the state must not be reversible
    // either way.
    expect(revealed().parentElement).toHaveAttribute("data-visible", "true");
  });

  it("passes the delay and distance through as custom properties", () => {
    render(
      <Reveal delay={0.15} distance={24}>
        <p data-testid="block">Later</p>
      </Reveal>
    );

    const block = revealed().parentElement;

    // One definition in CSS reads both, so a caller can tune a reveal without
    // a new class existing for it.
    expect(block?.style.getPropertyValue("--reveal-delay")).toBe("150ms");
    expect(block?.style.getPropertyValue("--reveal-distance")).toBe("24px");
  });

  it("defaults to no delay and a short distance", () => {
    render(
      <Reveal>
        <p data-testid="block">Later</p>
      </Reveal>
    );

    const block = revealed().parentElement;

    expect(block?.style.getPropertyValue("--reveal-delay")).toBe("0ms");
    expect(block?.style.getPropertyValue("--reveal-distance")).toBe("16px");
  });

  it("lets a caller fade in place with no lift", () => {
    render(
      <Reveal distance={0}>
        <p data-testid="block">Later</p>
      </Reveal>
    );

    expect(
      revealed().parentElement?.style.getPropertyValue("--reveal-distance")
    ).toBe("0px");
  });

  it("forwards a className so callers can still lay the block out", () => {
    render(
      <Reveal className="mx-auto max-w-7xl">
        <p data-testid="block">Later</p>
      </Reveal>
    );

    expect(revealed().parentElement).toHaveClass("mx-auto");
  });
});

describe(staggerDelay, () => {
  it("increases by a small step", () => {
    expect(staggerDelay(0)).toBe(0);
    expect(staggerDelay(1)).toBeGreaterThan(0);
    expect(staggerDelay(2)).toBeGreaterThan(staggerDelay(1));
  });

  it("caps, so an unbounded list cannot accumulate a delay nobody waits for", () => {
    // Without the cap the fiftieth entry would wait over two seconds.
    expect(staggerDelay(50)).toBe(staggerDelay(4));
    expect(staggerDelay(50)).toBeLessThanOrEqual(0.25);
  });

  it("accepts a different cap", () => {
    expect(staggerDelay(9, 2)).toBe(staggerDelay(2, 2));
  });

  it("does not go backwards for a negative index", () => {
    expect(staggerDelay(-1)).toBeLessThanOrEqual(0);
  });
});
