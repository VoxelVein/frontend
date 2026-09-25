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
});

describe(formatDate, () => {
  it("formats in UTC so server and client agree", () => {
    expect(formatDate("2026-08-14T23:30:00.000Z")).toBe("Aug 14, 2026");
  });
});
