import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createDownloadDeduper,
  isPrefetchRequest,
} from "@/lib/download-counter";

describe(isPrefetchRequest, () => {
  it("detects prefetch and prerender requests", () => {
    expect(
      isPrefetchRequest(new Headers({ "sec-purpose": "prefetch" }))
    ).toBeTruthy();
    expect(
      isPrefetchRequest(new Headers({ "sec-purpose": "prefetch;prerender" }))
    ).toBeTruthy();
    expect(
      isPrefetchRequest(new Headers({ purpose: "prefetch" }))
    ).toBeTruthy();
    expect(
      isPrefetchRequest(new Headers({ "x-moz": "prefetch" }))
    ).toBeTruthy();
  });

  it("treats ordinary requests as real downloads", () => {
    expect(isPrefetchRequest(new Headers())).toBeFalsy();
    expect(isPrefetchRequest(new Headers({ accept: "*/*" }))).toBeFalsy();
  });
});

describe(createDownloadDeduper, () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("counts a client and file once per window", () => {
    const deduper = createDownloadDeduper({ windowMs: 1000 });

    expect(deduper.shouldCount("ip:1", "file-a")).toBeTruthy();
    expect(deduper.shouldCount("ip:1", "file-a")).toBeFalsy();
    expect(deduper.shouldCount("ip:1", "file-b")).toBeTruthy();
    expect(deduper.shouldCount("ip:2", "file-a")).toBeTruthy();
  });

  it("counts again after the window expires", () => {
    const deduper = createDownloadDeduper({ windowMs: 1000 });

    expect(deduper.shouldCount("ip:1", "file-a")).toBeTruthy();
    vi.advanceTimersByTime(1000);
    expect(deduper.shouldCount("ip:1", "file-a")).toBeTruthy();
  });

  it("puts unidentified clients in one shared bucket per file", () => {
    const deduper = createDownloadDeduper({ windowMs: 1000 });

    expect(deduper.shouldCount(null, "file-a")).toBeTruthy();
    expect(deduper.shouldCount(null, "file-a")).toBeFalsy();
    expect(deduper.shouldCount(null, "file-b")).toBeTruthy();
  });

  it("evicts the oldest entry when full", () => {
    const deduper = createDownloadDeduper({ maxEntries: 2, windowMs: 1000 });

    deduper.shouldCount("ip:1", "file-a");
    deduper.shouldCount("ip:2", "file-a");
    deduper.shouldCount("ip:3", "file-a");

    expect(deduper.shouldCount("ip:1", "file-a")).toBeTruthy();
    expect(deduper.shouldCount("ip:3", "file-a")).toBeFalsy();
  });
});
