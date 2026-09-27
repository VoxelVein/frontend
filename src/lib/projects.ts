import {
  array,
  boolean,
  check,
  forward,
  integer,
  maxLength,
  maxValue,
  minLength,
  minValue,
  nonEmpty,
  nullable,
  number,
  object,
  partialCheck,
  picklist,
  pipe,
  regex,
  string,
  toLowerCase,
  trim,
  uuid,
} from "valibot";
import type { InferOutput } from "valibot";

import { MINECRAFT_VERSION_MANIFEST } from "@/lib/minecraft-version-manifest";

export const PROJECT_TYPES = [
  "mod",
  "modpack",
  "plugin",
  "resourcepack",
  "shader",
  "server",
] as const;
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

export const MODPACK_CATEGORIES = [
  "adventure",
  "technology",
  "magic",
  "kitchen-sink",
  "lightweight",
  "multiplayer",
] as const;

export const RESOURCE_PACK_CATEGORIES = [
  "faithful",
  "realistic",
  "cartoon",
  "pvp",
  "utility",
  "audio",
] as const;

export const SHADER_CATEGORIES = [
  "realistic",
  "fantasy",
  "performance",
  "cartoon",
] as const;

export const SERVER_CATEGORIES = [
  "survival",
  "creative",
  "minigames",
  "pvp",
  "roleplay",
  "skyblock",
  "modded",
  "anarchy",
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

/** Every selectable Minecraft version id, releases and snapshots, newest first. */
export const GAME_VERSIONS: readonly string[] = MINECRAFT_VERSION_MANIFEST.map(
  ([id]) => id
);

const GAME_VERSION_SET = new Set(GAME_VERSIONS);

export const isGameVersion = (value: string): boolean =>
  GAME_VERSION_SET.has(value);

export const MOD_LOADERS = ["fabric", "forge", "neoforge", "quilt"] as const;

export const PLUGIN_PLATFORMS = [
  "paper",
  "spigot",
  "velocity",
  "bungeecord",
] as const;

export const SHADER_LOADERS = ["iris", "optifine", "canvas"] as const;

export const CATEGORIES_BY_TYPE = {
  mod: MOD_CATEGORIES,
  modpack: MODPACK_CATEGORIES,
  plugin: PLUGIN_CATEGORIES,
  resourcepack: RESOURCE_PACK_CATEGORIES,
  server: SERVER_CATEGORIES,
  shader: SHADER_CATEGORIES,
} as const satisfies Record<ProjectType, readonly string[]>;

/**
 * What a version runs on: mod loaders, server platforms, or shader loaders.
 * Empty for types that need nothing (resource packs) or have no versions
 * (servers).
 */
export const LOADERS_BY_TYPE = {
  mod: MOD_LOADERS,
  modpack: MOD_LOADERS,
  plugin: PLUGIN_PLATFORMS,
  resourcepack: [],
  server: [],
  shader: SHADER_LOADERS,
} as const satisfies Record<ProjectType, readonly string[]>;

/** Singular and plural label for the loader field, per type. */
export const LOADER_LABELS = {
  mod: { plural: "Loaders", singular: "Loader" },
  modpack: { plural: "Loaders", singular: "Loader" },
  plugin: { plural: "Platforms", singular: "Platform" },
  resourcepack: { plural: "Loaders", singular: "Loader" },
  server: { plural: "Loaders", singular: "Loader" },
  shader: { plural: "Shader loaders", singular: "Shader loader" },
} as const satisfies Record<ProjectType, { plural: string; singular: string }>;

export const hasLoaders = (type: ProjectType): boolean =>
  LOADERS_BY_TYPE[type].length > 0;

/** Servers are listings with an address; every other type ships files. */
export const hasVersions = (type: ProjectType): boolean => type !== "server";

export const PROJECT_TYPE_LABELS = {
  mod: { plural: "Mods", singular: "Mod" },
  modpack: { plural: "Modpacks", singular: "Modpack" },
  plugin: { plural: "Plugins", singular: "Plugin" },
  resourcepack: { plural: "Resource Packs", singular: "Resource Pack" },
  server: { plural: "Servers", singular: "Server" },
  shader: { plural: "Shaders", singular: "Shader" },
} as const satisfies Record<ProjectType, { plural: string; singular: string }>;

/** URL section each type's pages live under. */
export const PROJECT_TYPE_PATHS = {
  mod: "/mods",
  modpack: "/modpacks",
  plugin: "/plugins",
  resourcepack: "/resource-packs",
  server: "/servers",
  shader: "/shaders",
} as const satisfies Record<ProjectType, string>;

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

const gameVersionsSchema = pipe(
  array(pipe(string(), check(isGameVersion, "Choose a known game version."))),
  minLength(1, "Choose at least one game version.")
);

export const versionInputSchema = object({
  changelog: pipe(
    string(),
    maxLength(CHANGELOG_MAX_LENGTH, "The changelog is too long.")
  ),
  channel: picklist(RELEASE_CHANNELS),
  gameVersions: gameVersionsSchema,
  // Types without loaders send an empty list; createVersion checks the
  // choice against the project's type.
  loaders: array(string()),
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

export const DEFAULT_SERVER_PORT = 25_565;
const MAX_PORT = 65_535;
const ADDRESS_MAX_LENGTH = 253;

// A hostname (play.example.net) or an IPv4 address; no scheme, path, or port.
const HOSTNAME_PATTERN =
  /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/iu;
// A bare IPv6 address such as 2001:db8::1.
const IPV6_PATTERN = /^[0-9a-f]{0,4}(?::[0-9a-f]{0,4}){2,7}$/iu;

export const isServerAddress = (value: string): boolean =>
  HOSTNAME_PATTERN.test(value) || IPV6_PATTERN.test(value);

export const serverInputSchema = object({
  address: pipe(
    string(),
    trim(),
    toLowerCase(),
    nonEmpty("Server address is required."),
    maxLength(ADDRESS_MAX_LENGTH),
    check(
      isServerAddress,
      "Enter a hostname or IP address without a port, like play.example.net."
    )
  ),
  gameVersions: gameVersionsSchema,
  modpackId: nullable(pipe(string(), uuid())),
  modpackRequired: boolean(),
  port: nullable(
    pipe(
      number(),
      integer("The port must be a whole number."),
      minValue(1, `Use a port between 1 and ${MAX_PORT}.`),
      maxValue(MAX_PORT, `Use a port between 1 and ${MAX_PORT}.`)
    )
  ),
  projectId: pipe(string(), uuid()),
});

export type ServerInput = InferOutput<typeof serverInputSchema>;

/** Formats `address[:port]`, leaving out the default port. */
export const formatServerAddress = (
  address: string,
  port: number | null
): string => {
  if (port === null || port === DEFAULT_SERVER_PORT) {
    return address;
  }
  return address.includes(":") ? `[${address}]:${port}` : `${address}:${port}`;
};

export interface ProjectServerView {
  address: string;
  gameVersions: string[];
  /** The linked modpack, only while it is published. */
  modpack: { name: string; slug: string } | null;
  /** Saved even while the modpack is hidden, so the owner's form keeps it. */
  modpackId: string | null;
  modpackRequired: boolean;
  port: number | null;
}

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
  /** Join details; only servers have them, and only once saved. */
  server: ProjectServerView | null;
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
