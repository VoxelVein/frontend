import { describe, expect, it } from "vitest";

import {
  MINECRAFT_VERSIONS,
  UNSTABLE_MINECRAFT_VERSIONS,
  formatMinecraftVersion,
  getMinecraftVersion,
} from "@/lib/minecraft-versions";
import { GAME_VERSIONS } from "@/lib/projects";

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

  describe("agreement with GAME_VERSIONS", () => {
    // GAME_VERSIONS has to stay a literal tuple for picklist(), so the two
    // cannot be linked by inference. These assertions are the link.
    it("offers every stable release in the catalog", () => {
      const stable = MINECRAFT_VERSIONS.filter((v) => v.stable).map(
        (v) => v.id
      );
      expect(GAME_VERSIONS).toStrictEqual(expect.arrayContaining(stable));
    });

    it("never offers a snapshot-only release", () => {
      for (const version of UNSTABLE_MINECRAFT_VERSIONS) {
        expect(GAME_VERSIONS).not.toContain(version.id);
      }
    });

    it("keeps the legacy ids that predate the catalog", () => {
      // Projects already reference these. Removing them would orphan stored
      // data, and the catalog has no entry to reintroduce them from.
      expect(GAME_VERSIONS).toStrictEqual(
        expect.arrayContaining(["1.20.4", "1.20.1", "1.19.4", "1.18.2"])
      );
    });

    it("lists versions newest first for the picker", () => {
      expect(GAME_VERSIONS[0]).toBe("26.2");
      expect(GAME_VERSIONS.at(-1)).toBe("1.18.2");
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
