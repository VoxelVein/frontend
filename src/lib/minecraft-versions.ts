/**
 * Minecraft release catalog.
 *
 * `GAME_VERSIONS` in `@/lib/projects` is the literal tuple that the upload form
 * and the valibot schema both read, and a literal tuple cannot be derived from
 * this catalog without losing its type. So the two are kept in sync by a test
 * (`minecraft-versions.test.ts`) rather than by inference: every id offered to
 * a user must exist here and be a stable release.
 *
 * Release metadata is carried over from the `xROT` branch and is not verified
 * against Mojang's official announcements. Treat `update`/`fullRelease` as
 * display copy, not as a source of truth.
 */

export const MINECRAFT_VERSION_SERIES = ["26", "1.21"] as const;

export type MinecraftVersionSeries = (typeof MINECRAFT_VERSION_SERIES)[number];

export interface MinecraftVersion {
  /** Version id, also what gets persisted to `project_versions`. */
  id: string;
  /** Human-facing label. Identical to `id` today, kept separate for i18n. */
  name: string;
  series: MinecraftVersionSeries;
  /** Codename of the snapshot, or "" when the release had none. */
  update: string;
  /** Date the first snapshot shipped, or null if it predates tracking. */
  developmentRelease: string | null;
  /** Date the full release shipped, or null if not released yet. */
  fullRelease: string | null;
  /** False while the version is snapshot-only and not a full release yet. */
  stable: boolean;
}

export const MINECRAFT_VERSIONS = [
  {
    developmentRelease: "June 23, 2026",
    fullRelease: "September 2026",
    id: "26.3",
    name: "26.3",
    series: "26",
    stable: false,
    update: "Wilderness Bound",
  },
  {
    developmentRelease: "April 7, 2026",
    fullRelease: "June 16, 2026",
    id: "26.2",
    name: "26.2",
    series: "26",
    stable: true,
    update: "Chaos Cubed",
  },
  {
    developmentRelease: "December 16, 2025",
    fullRelease: "March 24, 2026",
    id: "26.1",
    name: "26.1",
    series: "26",
    stable: true,
    update: "Tiny Takeover",
  },
  {
    developmentRelease: "October 9, 2025",
    fullRelease: "December 9, 2025",
    id: "1.21.11",
    name: "1.21.11",
    series: "1.21",
    stable: true,
    update: "Mounts of Mayhem",
  },
  {
    developmentRelease: "October 2, 2025",
    fullRelease: "October 7, 2025",
    id: "1.21.10",
    name: "1.21.10",
    series: "1.21",
    stable: true,
    update: "The Copper Age",
  },
  {
    developmentRelease: "July 29, 2025",
    fullRelease: "September 30, 2025",
    id: "1.21.9",
    name: "1.21.9",
    series: "1.21",
    stable: true,
    update: "",
  },
  {
    developmentRelease: "July 15, 2025",
    fullRelease: "July 17, 2025",
    id: "1.21.8",
    name: "1.21.8",
    series: "1.21",
    stable: true,
    update: "Chase the Skies",
  },
  {
    developmentRelease: "June 25, 2025",
    fullRelease: "June 30, 2025",
    id: "1.21.7",
    name: "1.21.7",
    series: "1.21",
    stable: true,
    update: "",
  },
  {
    developmentRelease: "April 8, 2025",
    fullRelease: "June 17, 2025",
    id: "1.21.6",
    name: "1.21.6",
    series: "1.21",
    stable: true,
    update: "",
  },
  {
    developmentRelease: "January 8, 2025",
    fullRelease: "March 25, 2025",
    id: "1.21.5",
    name: "1.21.5",
    series: "1.21",
    stable: true,
    update: "Spring to Life",
  },
  {
    developmentRelease: "October 30, 2024",
    fullRelease: "December 3, 2024",
    id: "1.21.4",
    name: "1.21.4",
    series: "1.21",
    stable: true,
    update: "The Garden Awakens",
  },
  {
    developmentRelease: null,
    fullRelease: "October 23, 2024",
    id: "1.21.3",
    name: "1.21.3",
    series: "1.21",
    stable: true,
    update: "Bundles of Bravery",
  },
  {
    developmentRelease: "August 15, 2024",
    fullRelease: "October 22, 2024",
    id: "1.21.2",
    name: "1.21.2",
    series: "1.21",
    stable: true,
    update: "",
  },
  {
    developmentRelease: "August 7, 2024",
    fullRelease: "August 8, 2024",
    id: "1.21.1",
    name: "1.21.1",
    series: "1.21",
    stable: true,
    update: "Tricky Trials",
  },
  {
    developmentRelease: "May 3, 2024",
    fullRelease: "June 13, 2024",
    id: "1.21",
    name: "1.21",
    series: "1.21",
    stable: true,
    update: "",
  },
] as const satisfies readonly MinecraftVersion[];

const bySeries = (series: MinecraftVersionSeries) =>
  MINECRAFT_VERSIONS.filter((version) => version.series === series);

export const MINECRAFT_26_VERSIONS = bySeries("26");
export const MINECRAFT_1_21_VERSIONS = bySeries("1.21");

/** Snapshot-only and unreleased entries, newest first. */
export const UNSTABLE_MINECRAFT_VERSIONS = MINECRAFT_VERSIONS.filter(
  (version) => !version.stable
);

/** Looks up release metadata, or undefined for an id we do not track. */
export const getMinecraftVersion = (id: string): MinecraftVersion | undefined =>
  MINECRAFT_VERSIONS.find((version) => version.id === id);

/** `"1.21.8 (Chase the Skies)"`, or just the id when the release has no name. */
export const formatMinecraftVersion = (id: string): string => {
  const version = getMinecraftVersion(id);
  if (!version?.update) {
    return `Minecraft ${id}`;
  }
  return `Minecraft ${version.id} (${version.update})`;
};
