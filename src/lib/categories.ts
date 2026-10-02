import {
  IconBox,
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
   * Shown inline in the navbar from `lg`. The rest wait for `xl` and sit in
   * the navbar's "More" menu until then, so every category stays reachable.
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
    alwaysInline: true,
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
];

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
