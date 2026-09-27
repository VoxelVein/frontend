import { describe, expect, it } from "vitest";

import {
  filterGameVersions,
  LINE_PREFIX,
  MAX_VISIBLE_VERSIONS,
  newestFirst,
} from "@/lib/game-version-search";

describe(filterGameVersions, () => {
  it("lists only releases until snapshots are asked for", () => {
    const releases = filterGameVersions("", false);
    expect(releases).toContain("1.20.1");
    expect(releases).not.toContain("24w14a");
    expect(filterGameVersions("24w14", true)).toContain("24w14a");
  });

  it("offers the whole line first when the query names one", () => {
    const options = filterGameVersions("1.20", false);
    expect(options[0]).toBe(`${LINE_PREFIX}1.20`);
    expect(options).toContain("1.20.4");
  });

  it("ranks versions that start with the query above partial matches", () => {
    const options = filterGameVersions("1.2", false, false);
    expect(options[0]?.startsWith("1.2")).toBeTruthy();
    expect(options.indexOf("1.2.5")).toBeGreaterThanOrEqual(0);
  });

  it("leaves the line shortcut out when asked", () => {
    expect(filterGameVersions("1.20", false, false)[0]).toBe("1.20.6");
  });

  it("caps how many options render at once", () => {
    expect(filterGameVersions("", true)).toHaveLength(MAX_VISIBLE_VERSIONS);
  });
});

describe(newestFirst, () => {
  it("orders and deduplicates the way Mojang lists versions", () => {
    expect(newestFirst(["1.18.2", "1.21", "1.18.2", "24w14a"])).toStrictEqual([
      "1.21",
      "24w14a",
      "1.18.2",
    ]);
  });
});
