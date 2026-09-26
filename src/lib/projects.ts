import {
  array,
  forward,
  maxLength,
  minLength,
  nonEmpty,
  object,
  partialCheck,
  picklist,
  pipe,
  regex,
  string,
  trim,
  uuid,
} from "valibot";
import type { InferOutput } from "valibot";

export const PROJECT_TYPES = ["mod", "plugin"] as const;
export type ProjectType = (typeof PROJECT_TYPES)[number];

export const PROJECT_STATUSES = ["draft", "published", "removed"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const RELEASE_CHANNELS = ["release", "beta", "alpha"] as const;
export type ReleaseChannel = (typeof RELEASE_CHANNELS)[number];

export const MOD_CATEGORIES = [
  "performance",
  "technology",
  "utility",
  "adventure",
  "magic",
  "building",
] as const;

export const PLUGIN_CATEGORIES = [
  "administration",
  "economy",
  "chat",
  "protection",
  "minigames",
  "world-management",
  "utility",
] as const;

/**
 * Selectable Minecraft versions, newest first.
 *
 * Kept as a literal tuple rather than derived from `MINECRAFT_VERSIONS` because
 * `picklist()` below needs the literal type to enforce it at compile time. A
 * test pins the two together: every stable release in the catalog must appear
 * here, and snapshot-only releases must not.
 *
 * The 1.20.x-1.18.x entries predate the catalog and stay because projects
 * already reference them — dropping them would orphan stored data.
 */
export const GAME_VERSIONS = [
  "26.2",
  "26.1",
  "1.21.11",
  "1.21.10",
  "1.21.9",
  "1.21.8",
  "1.21.7",
  "1.21.6",
  "1.21.5",
  "1.21.4",
  "1.21.3",
  "1.21.2",
  "1.21.1",
  "1.21",
  "1.20.4",
  "1.20.1",
  "1.19.4",
  "1.18.2",
] as const;

export const MOD_LOADERS = ["fabric", "forge", "neoforge"] as const;

export const PLUGIN_PLATFORMS = [
  "paper",
  "spigot",
  "velocity",
  "bungeecord",
] as const;

export const CATEGORIES_BY_TYPE = {
  mod: MOD_CATEGORIES,
  plugin: PLUGIN_CATEGORIES,
} as const satisfies Record<ProjectType, readonly string[]>;

/** Mod loaders for mods, server platforms for plugins. */
export const LOADERS_BY_TYPE = {
  mod: MOD_LOADERS,
  plugin: PLUGIN_PLATFORMS,
} as const satisfies Record<ProjectType, readonly string[]>;

export const PROJECT_TYPE_LABELS = {
  mod: { plural: "Mods", singular: "Mod" },
  plugin: { plural: "Plugins", singular: "Plugin" },
} as const satisfies Record<ProjectType, { plural: string; singular: string }>;

// Slugs appear in URLs: lowercase letters, digits, and single dashes.
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
export const SLUG_MAX_LENGTH = 64;

/** Search document for one published project, as stored in Meilisearch. */
export interface ProjectDocument {
  author: string;
  category: string;
  description: string;
  downloads: number;
  gameVersions: string[];
  id: string;
  loaders: string[];
  name: string;
  slug: string;
  tags: string[];
  type: ProjectType;
  updatedAt: string;
  version: string;
}

export const isProjectType = (value: string): value is ProjectType =>
  // SAFETY: widening the readonly tuple to readonly string[] is only used for
  // the membership check.
  (PROJECT_TYPES as readonly string[]).includes(value);

const NAME_MAX_LENGTH = 64;
const SUMMARY_MAX_LENGTH = 160;
const DESCRIPTION_MAX_LENGTH = 50_000;
const CHANGELOG_MAX_LENGTH = 20_000;
const MAX_TAGS = 8;
const TAG_MAX_LENGTH = 24;
const VERSION_NUMBER_MAX_LENGTH = 32;

// Version numbers go into storage keys and filenames: keep them simple.
const VERSION_NUMBER_PATTERN = /^[0-9A-Za-z][0-9A-Za-z.+_-]*$/u;

export const projectSlugSchema = pipe(
  string(),
  trim(),
  nonEmpty("Slug is required."),
  maxLength(SLUG_MAX_LENGTH, `Use at most ${SLUG_MAX_LENGTH} characters.`),
  regex(SLUG_PATTERN, "Use lowercase letters, numbers, and single hyphens.")
);

const projectFieldsEntries = {
  category: pipe(string(), nonEmpty("Choose a category.")),
  description: pipe(
    string(),
    maxLength(DESCRIPTION_MAX_LENGTH, "The description is too long.")
  ),
  name: pipe(
    string(),
    trim(),
    nonEmpty("Name is required."),
    maxLength(NAME_MAX_LENGTH, `Use at most ${NAME_MAX_LENGTH} characters.`)
  ),
  summary: pipe(
    string(),
    trim(),
    nonEmpty("Summary is required."),
    maxLength(
      SUMMARY_MAX_LENGTH,
      `Use at most ${SUMMARY_MAX_LENGTH} characters.`
    )
  ),
  tags: pipe(
    array(
      pipe(
        string(),
        trim(),
        nonEmpty(),
        maxLength(
          TAG_MAX_LENGTH,
          `Tags are at most ${TAG_MAX_LENGTH} characters.`
        )
      )
    ),
    maxLength(MAX_TAGS, `Use at most ${MAX_TAGS} tags.`)
  ),
};

export const isCategoryForType = (
  type: ProjectType,
  category: string
): boolean =>
  // SAFETY: widening to readonly string[] is only used for the membership
  // check.
  (CATEGORIES_BY_TYPE[type] as readonly string[]).includes(category);

export const projectInputSchema = pipe(
  object({
    ...projectFieldsEntries,
    slug: projectSlugSchema,
    type: picklist(PROJECT_TYPES),
  }),
  forward(
    partialCheck(
      [["category"], ["type"]],
      (input) => isCategoryForType(input.type, input.category),
      "Choose a category for this project type."
    ),
    ["category"]
  )
);

export type ProjectInput = InferOutput<typeof projectInputSchema>;

export const projectUpdateSchema = object({
  ...projectFieldsEntries,
  projectId: pipe(string(), uuid()),
});

export type ProjectUpdateInput = InferOutput<typeof projectUpdateSchema>;

export const versionInputSchema = object({
  changelog: pipe(
    string(),
    maxLength(CHANGELOG_MAX_LENGTH, "The changelog is too long.")
  ),
  channel: picklist(RELEASE_CHANNELS),
  gameVersions: pipe(
    array(picklist(GAME_VERSIONS)),
    minLength(1, "Choose at least one game version.")
  ),
  loaders: pipe(array(string()), minLength(1, "Choose at least one loader.")),
  name: pipe(string(), trim(), maxLength(NAME_MAX_LENGTH)),
  projectId: pipe(string(), uuid()),
  versionNumber: pipe(
    string(),
    trim(),
    nonEmpty("Version number is required."),
    maxLength(VERSION_NUMBER_MAX_LENGTH),
    regex(
      VERSION_NUMBER_PATTERN,
      "Use letters, numbers, dots, dashes, underscores, and plus signs."
    )
  ),
});

export type VersionInput = InferOutput<typeof versionInputSchema>;

/** Public view of one uploaded file. */
export interface ProjectFileView {
  filename: string;
  id: string;
  primary: boolean;
  sha1: string;
  sha512: string;
  size: number;
}

export interface ProjectVersionView {
  changelog: string;
  channel: ReleaseChannel;
  createdAt: string;
  downloads: number;
  files: ProjectFileView[];
  gameVersions: string[];
  id: string;
  loaders: string[];
  name: string;
  versionNumber: string;
}

/** Author shown for projects kept after their owner deleted the account. */
export const DELETED_USER_LABEL = "Deleted user";

export interface ProjectView {
  author: string;
  category: string;
  description: string;
  downloads: number;
  id: string;
  /** Admin-marked large project, kept when its owner deletes their account. */
  isProtected: boolean;
  name: string;
  /** Null when the owner deleted their account and the project was kept. */
  ownerId: string | null;
  /** Chosen for deletion along with the owner's account; hidden meanwhile. */
  pendingDeletion: boolean;
  publishedAt: string | null;
  slug: string;
  status: ProjectStatus;
  summary: string;
  tags: string[];
  type: ProjectType;
  updatedAt: string;
  versions: ProjectVersionView[];
}

export interface ProjectListItem {
  downloads: number;
  id: string;
  name: string;
  slug: string;
  status: ProjectStatus;
  type: ProjectType;
  updatedAt: string;
  versionCount: number;
}
