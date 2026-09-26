import { describe, expect, it } from "vitest";

import { formatBytes, formatCount, formatDate } from "@/lib/format";

describe(formatBytes, () => {
  it("picks a readable unit", () => {
    expect(formatBytes(39)).toBe("39 B");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(25 * 1024 * 1024)).toBe("25 MB");
  });
});

describe(formatCount, () => {
  it("uses compact notation", () => {
    expect(formatCount(14_200_000)).toBe("14.2M");
    expect(formatCount(950)).toBe("950");
  });

  // Each step is 1000x the previous, so the suffix has to change at 10^3.
  it("abbreviates at every 1000x step", () => {
    expect(formatCount(1000)).toBe("1K");
    expect(formatCount(1_000_000)).toBe("1M");
    expect(formatCount(1_000_000_000)).toBe("1B");
    expect(formatCount(1_000_000_000_000)).toBe("1T");
  });

  // English compact notation uses B for billion, not G, so 5e9 is "5B" and
  // "T" does not appear until 10^12. Compact notation is for display only —
  // never parse it back.
  it("uses B for billions and reserves T for trillions", () => {
    expect(formatCount(5_000_000_000)).toBe("5B");
    expect(formatCount(999_999_999_999)).toBe("1T");
  });

  it("keeps at most one fraction digit", () => {
    expect(formatCount(1_234_567)).toBe("1.2M");
  });
});

describe(formatDate, () => {
  it("formats in UTC so server and client agree", () => {
    expect(formatDate("2026-08-14T23:30:00.000Z")).toBe("Aug 14, 2026");
  });
});
