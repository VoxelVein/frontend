import { describe, expect, it } from "vitest";

import {
  MINECRAFT_VERSIONS,
  UNSTABLE_MINECRAFT_VERSIONS,
  formatMinecraftVersion,
  getMinecraftVersion,
  getReleasesInLine,
  getVersionLine,
  isSnapshotVersion,
  RELEASE_GAME_VERSIONS,
} from "@/lib/minecraft-versions";
import { GAME_VERSIONS, isGameVersion } from "@/lib/projects";

describe("Minecraft version catalog", () => {
  it("has no duplicate ids", () => {
    const ids = MINECRAFT_VERSIONS.map((version) => version.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("is ordered newest first", () => {
    // The catalog doubles as the display order, so no release may sit below a
    // newer one. Comparing consecutive pairs keeps this independent of
    // Array#sort, which the lint rules and the TS lib target disagree about.
    // Reporting the offending pairs makes a failure name the regression.
    const outOfOrder = MINECRAFT_VERSIONS.flatMap((version, index, all) => {
      const previous = all[index - 1];
      const now = version.fullRelease ? Date.parse(version.fullRelease) : null;
      const before = previous?.fullRelease
        ? Date.parse(previous.fullRelease)
        : null;
      if (now === null || before === null || before >= now) {
        return [];
      }
      return [`${version.id} is listed below the newer ${previous?.id}`];
    });

    expect(outOfOrder).toStrictEqual([]);
  });

  describe("agreement with the Mojang manifest", () => {
    // The catalog only adds codenames; the manifest decides what users can
    // pick. A catalog entry missing from it would label an unselectable id.
    it("only describes versions the manifest offers", () => {
      const missing = MINECRAFT_VERSIONS.filter(
        (version) => version.stable && !isGameVersion(version.id)
      ).map((version) => version.id);
      expect(missing).toStrictEqual([]);
    });

    it("marks snapshot-only catalog entries as snapshots or omits them", () => {
      for (const version of UNSTABLE_MINECRAFT_VERSIONS) {
        expect(RELEASE_GAME_VERSIONS).not.toContain(version.id);
      }
    });
  });

  describe(getMinecraftVersion, () => {
    it("finds a tracked release", () => {
      expect(getMinecraftVersion("1.21.8")?.update).toBe("Chase the Skies");
    });

    it("returns undefined for an untracked id", () => {
      expect(getMinecraftVersion("1.7.10")).toBeUndefined();
    });
  });

  describe(formatMinecraftVersion, () => {
    it("appends the codename when the release has one", () => {
      expect(formatMinecraftVersion("1.21.8")).toBe(
        "Minecraft 1.21.8 (Chase the Skies)"
      );
    });

    it("omits empty parentheses for an unnamed release", () => {
      expect(formatMinecraftVersion("1.21.9")).toBe("Minecraft 1.21.9");
    });

    it("still labels a version the catalog does not track", () => {
      // Legacy ids stay selectable, so the label must not degrade to nothing.
      expect(formatMinecraftVersion("1.18.2")).toBe("Minecraft 1.18.2");
    });
  });
});

describe("Mojang version manifest", () => {
  it("has no duplicate ids", () => {
    expect(new Set(GAME_VERSIONS).size).toBe(GAME_VERSIONS.length);
  });

  it("offers releases and snapshots", () => {
    expect(RELEASE_GAME_VERSIONS.length).toBeGreaterThan(90);
    expect(GAME_VERSIONS.length).toBeGreaterThan(RELEASE_GAME_VERSIONS.length);
    expect(isSnapshotVersion("24w14a")).toBeTruthy();
    expect(isSnapshotVersion("1.20.1")).toBeFalsy();
  });

  it("keeps every version projects already reference", () => {
    // Stored versions must stay valid after the switch from the old list.
    for (const id of [
      "26.2",
      "26.1",
      "1.21.11",
      "1.21",
      "1.20.4",
      "1.20.1",
      "1.19.4",
      "1.18.2",
    ]) {
      expect(isGameVersion(id)).toBeTruthy();
    }
  });

  it("lists releases newest first", () => {
    const oldest = RELEASE_GAME_VERSIONS.at(-1);
    expect(oldest).toBe("1.0");
    expect(RELEASE_GAME_VERSIONS.indexOf("1.21")).toBeLessThan(
      RELEASE_GAME_VERSIONS.indexOf("1.20.6")
    );
  });

  it("rejects ids Mojang never shipped", () => {
    expect(isGameVersion("1.99")).toBeFalsy();
    expect(isGameVersion("")).toBeFalsy();
  });
});

describe(getVersionLine, () => {
  it("groups releases by their first two parts", () => {
    expect(getVersionLine("1.20.4")).toBe("1.20");
    expect(getVersionLine("1.20")).toBe("1.20");
    expect(getVersionLine("26.1.2")).toBe("26.1");
  });

  it("puts snapshots in no line", () => {
    expect(getVersionLine("24w14a")).toBeNull();
    expect(getVersionLine("1.21-pre1")).toBeNull();
  });
});

describe(getReleasesInLine, () => {
  it("lists a line's releases newest first", () => {
    const line = getReleasesInLine("1.20");
    expect(line[0]).toBe("1.20.6");
    expect(line.at(-1)).toBe("1.20");
    expect(line).not.toContain("1.21");
  });
});
