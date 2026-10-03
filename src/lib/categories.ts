import {
  IconBox,
  IconDatabase,
  IconPackages,
  IconPalette,
  IconPhoto,
  IconServer,
  IconWorld,
} from "@tabler/icons-react";
import type { Icon } from "@tabler/icons-react";

interface MinecraftCategory {
  /**
   * Whether the category's browse route exists yet. Unavailable categories are
   * presented as coming soon rather than as links, so nothing advertises a
   * destination that 404s.
   */
  available: boolean;
  /**
   * Whether this section gets a flat navbar link or shares the "Browse" menu.
   *
   * Only the two destinations most visitors arrive for are flat. Every other
   * section renders the same `ProjectBrowser` component with a different type,
   * so listing all of them as text links said seven near-identical things and
   * crowded out the rest of the bar. The menu keeps all of them reachable and
   * adds each description, which a flat link has nowhere to put.
   */
  alwaysInline: boolean;
  description: string;
  href: string;
  icon: Icon;
  label: string;
}

/**
 * The Minecraft content categories VoxelVein groups projects into.
 *
 * Single source of truth for the navbar's project menu and the landing page's
 * explore section, so a category's route or availability can never drift
 * between them. Keep the list in navbar order: the navbar and the explore
 * grid both render it in sequence.
 */
const MINECRAFT_CATEGORIES: readonly MinecraftCategory[] = [
  {
    available: true,
    alwaysInline: true,
    description: "Enhance Minecraft with new features, mechanics, and content.",
    href: "/mods",
    icon: IconBox,
    label: "Mods",
  },
  {
    available: true,
    alwaysInline: false,
    description: "Discover curated collections of mods for every playstyle.",
    href: "/modpacks",
    icon: IconPackages,
    label: "Modpacks",
  },
  {
    available: true,
    alwaysInline: true,
    description: "Extend your Minecraft server with powerful plugins.",
    href: "/plugins",
    icon: IconServer,
    label: "Plugins",
  },
  {
    available: true,
    alwaysInline: false,
    description: "Change the look and feel of your Minecraft experience.",
    href: "/resource-packs",
    icon: IconPhoto,
    label: "Resource Packs",
  },
  {
    available: true,
    alwaysInline: false,
    description: "Stunning visual effects for your world.",
    href: "/shaders",
    icon: IconPalette,
    label: "Shaders",
  },
  {
    available: true,
    alwaysInline: false,
    description: "Communities and worlds to play in with others.",
    href: "/servers",
    icon: IconWorld,
    label: "Servers",
  },
  {
    available: true,
    alwaysInline: false,
    description:
      "Add dimensions, biomes, loot tables, and recipes to your world.",
    href: "/datapacks",
    icon: IconDatabase,
    label: "Datapacks",
  },
];

/**
 * Every category label as one lower-cased prose list.
 *
 * "mods, plugins, modpacks, resource packs, shaders, and servers". The hero
 * and the explore section both need this sentence, and both previously carried
 * their own copy — which is how the hero came to advertise a `Datapack` type
 * that does not exist while leaving out `Servers`. Deriving both from here
 * means a category can only be added in one place.
 */
export const categoryLabelSentence = (): string => {
  const labels = MINECRAFT_CATEGORIES.map((category) =>
    category.label.toLowerCase()
  );
  const last = labels.at(-1);
  if (last === undefined) {
    // An emptied registry degrades the sentence instead of crashing a render.
    return "";
  }
  const head = labels.slice(0, -1).join(", ");
  // One category is just its own name; two or more read as an Oxford list.
  return head === "" ? last : `${head}, and ${last}`;
};

export { MINECRAFT_CATEGORIES };
export type { MinecraftCategory };

/**
 * The category icon for a browse path, or null if the path is not a category.
 *
 * Keyed off `href`, which the registry already stores, so a section's icon has
 * exactly one home rather than a second copy per call site.
 */
export const categoryIconForPath = (path: string): Icon | null =>
  MINECRAFT_CATEGORIES.find((category) => category.href === path)?.icon ?? null;
