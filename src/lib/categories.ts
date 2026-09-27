import {
  IconBox,
  IconDeviceGamepad2,
  IconPackages,
  IconPalette,
  IconPhoto,
  IconServer,
} from "@tabler/icons-react";
import type { Icon } from "@tabler/icons-react";

interface MinecraftCategory {
  /**
   * Whether the category's browse route exists yet. Unavailable categories are
   * presented as coming soon rather than as links, so nothing advertises a
   * destination that 404s.
   */
  available: boolean;
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
    description: "Enhance Minecraft with new features, mechanics, and content.",
    href: "/mods",
    icon: IconBox,
    label: "Mods",
  },
  {
    available: false,
    description: "Discover curated collections of mods for every playstyle.",
    href: "/modpacks",
    icon: IconPackages,
    label: "Modpacks",
  },
  {
    available: true,
    description: "Extend your Minecraft server with powerful plugins.",
    href: "/plugins",
    icon: IconServer,
    label: "Plugins",
  },
  {
    available: false,
    description: "Change the look and feel of your Minecraft experience.",
    href: "/resource-packs",
    icon: IconDeviceGamepad2,
    label: "Resource Packs",
  },
  {
    available: false,
    description: "Stunning visual effects for your world.",
    href: "/shaders",
    icon: IconPalette,
    label: "Shaders",
  },
  {
    available: false,
    description: "Communities and worlds to play in with others.",
    href: "/servers",
    icon: IconPhoto,
    label: "Servers",
  },
];

export { MINECRAFT_CATEGORIES };
export type { MinecraftCategory };
