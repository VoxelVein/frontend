import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RotatingText } from "@/components/motion/rotating-text";

const TEXTS = ["Alpha", "Beta"];
const INTERVAL_MS = 1000;
// One 400ms transition with no stagger, plus slack.
const EXIT_MS = 500;

describe(RotatingText, () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // jsdom has no ResizeObserver; measuring is not under test here.
    vi.stubGlobal(
      "ResizeObserver",
      class {
        disconnect = vi.fn<() => void>();
        observe = vi.fn<() => void>();
      }
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("moves to the next text after the interval", () => {
    render(
      <RotatingText
        texts={TEXTS}
        rotationInterval={INTERVAL_MS}
        staggerDuration={0}
      />
    );

    // Each character is its own element; the full texts only exist as
    // invisible sizers, so a lone "B" means Beta is the visible text.
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.queryByText("B")).toBeNull();

    act(() => {
      vi.advanceTimersByTime(INTERVAL_MS);
    });
    act(() => {
      vi.advanceTimersByTime(EXIT_MS);
    });

    expect(screen.getByText("B")).toBeInTheDocument();
    expect(screen.queryByText("A")).toBeNull();
  });

  it("stays on the current text while paused", () => {
    render(
      <RotatingText
        texts={TEXTS}
        paused
        rotationInterval={INTERVAL_MS}
        staggerDuration={0}
      />
    );

    act(() => {
      vi.advanceTimersByTime(INTERVAL_MS * 3);
    });

    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.queryByText("B")).toBeNull();
  });
});
