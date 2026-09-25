import type { ProjectType } from "../../src/lib/projects.ts";

/** Development seed data. Files are generated; these are not real releases. */
export interface DemoProject {
  category: string;
  downloads: number;
  gameVersions: string[];
  loaders: string[];
  name: string;
  slug: string;
  summary: string;
  tags: string[];
  type: ProjectType;
  version: string;
}

export const DEMO_PROJECTS: DemoProject[] = [
  {
    category: "performance",
    downloads: 14_200_000,
    gameVersions: ["1.21", "1.20.4", "1.20.1", "1.19.4", "1.18.2"],
    loaders: ["fabric", "neoforge"],
    name: "Sodium",
    slug: "sodium",
    summary:
      "A rendering engine replacement that greatly improves frame rates and reduces micro-stutter.",
    tags: ["rendering", "optimization", "fps"],
    type: "mod",
    version: "0.6.12",
  },
  {
    category: "performance",
    downloads: 9_800_000,
    gameVersions: ["1.21", "1.20.4", "1.20.1", "1.19.4"],
    loaders: ["fabric", "neoforge"],
    name: "Iris Shaders",
    slug: "iris-shaders",
    summary:
      "A modern shaders mod for Minecraft that aims to provide compatibility and performance.",
    tags: ["shaders", "graphics", "rendering"],
    type: "mod",
    version: "1.8.3",
  },
  {
    category: "technology",
    downloads: 21_000_000,
    gameVersions: ["1.21", "1.20.4", "1.20.1", "1.19.4", "1.18.2"],
    loaders: ["forge", "neoforge", "fabric"],
    name: "Create",
    slug: "create",
    summary:
      "Build intricate mechanical systems, automated factories, and moving contraptions.",
    tags: ["machines", "automation", "kinetics"],
    type: "mod",
    version: "6.0.1",
  },
  {
    category: "utility",
    downloads: 31_000_000,
    gameVersions: ["1.21", "1.20.4", "1.20.1", "1.19.4", "1.18.2"],
    loaders: ["forge", "neoforge", "fabric"],
    name: "Just Enough Items",
    slug: "jei",
    summary:
      "View items and recipes in-game with a simple and powerful item and recipe viewer.",
    tags: ["recipes", "items", "interface"],
    type: "mod",
    version: "19.21.0",
  },
  {
    category: "utility",
    downloads: 8_700_000,
    gameVersions: ["1.21", "1.20.4", "1.20.1", "1.19.4", "1.18.2"],
    loaders: ["forge", "fabric", "neoforge"],
    name: "JourneyMap",
    slug: "journeymap",
    summary:
      "A real-time minimap and full-screen map with waypoints, markers, and death points.",
    tags: ["minimap", "waypoints", "exploration"],
    type: "mod",
    version: "5.10.3",
  },
  {
    category: "adventure",
    downloads: 6_400_000,
    gameVersions: ["1.21", "1.20.4", "1.20.1", "1.19.4"],
    loaders: ["forge", "fabric"],
    name: "Alex's Mobs",
    slug: "alexs-mobs",
    summary:
      "Adds over 90 new mobs to the game, from friendly critters to fearsome bosses.",
    tags: ["mobs", "creatures", "wildlife"],
    type: "mod",
    version: "1.22.9",
  },
  {
    category: "magic",
    downloads: 5_200_000,
    gameVersions: ["1.21", "1.20.4", "1.20.1", "1.19.4", "1.18.2"],
    loaders: ["forge", "fabric"],
    name: "Botania",
    slug: "botania",
    summary:
      "A tech-magic mod inspired by nature, with flowers that generate mana and powerful tools.",
    tags: ["magic", "flowers", "mana"],
    type: "mod",
    version: "1.21.1-446",
  },
  {
    category: "adventure",
    downloads: 7_800_000,
    gameVersions: ["1.21", "1.20.4", "1.20.1", "1.19.4"],
    loaders: ["forge", "neoforge"],
    name: "The Twilight Forest",
    slug: "twilight-forest",
    summary:
      "Explore a magical forest dimension filled with new bosses, dungeons, and treasures.",
    tags: ["dimension", "bosses", "dungeons"],
    type: "mod",
    version: "4.5.1",
  },
  {
    category: "building",
    downloads: 4_300_000,
    gameVersions: ["1.21", "1.20.4", "1.20.1", "1.19.4", "1.18.2"],
    loaders: ["forge", "fabric", "neoforge"],
    name: "Farmer's Delight",
    slug: "farmers-delight",
    summary:
      "Expands farming and cooking with new crops, meals, and a cozy rustic aesthetic.",
    tags: ["food", "farming", "cooking"],
    type: "mod",
    version: "1.20.1-1.2.4",
  },
  {
    category: "technology",
    downloads: 3_900_000,
    gameVersions: ["1.20.1", "1.19.4", "1.18.2"],
    loaders: ["forge"],
    name: "Tinkers' Construct",
    slug: "tinkers-construct",
    summary:
      "A modding toolkit that lets you build custom tools and weapons from many materials.",
    tags: ["tools", "materials", "crafting"],
    type: "mod",
    version: "3.8.3",
  },
  {
    category: "building",
    downloads: 6_100_000,
    gameVersions: ["1.21", "1.20.4", "1.20.1", "1.19.4", "1.18.2"],
    loaders: ["forge", "fabric", "neoforge"],
    name: "Quark",
    slug: "quark",
    summary:
      "A vanilla-plus mod that adds new blocks, tweaks, and quality-of-life features.",
    tags: ["vanilla-plus", "blocks", "quality-of-life"],
    type: "mod",
    version: "4.0.1",
  },
  {
    category: "performance",
    downloads: 11_000_000,
    gameVersions: ["1.21", "1.20.4", "1.20.1", "1.19.4", "1.18.2"],
    loaders: ["fabric"],
    name: "Lithium",
    slug: "lithium",
    summary:
      "A general-purpose optimization mod that improves game physics and mob AI performance.",
    tags: ["optimization", "server", "tick-rate"],
    type: "mod",
    version: "0.14.1",
  },
  {
    category: "administration",
    downloads: 182_000,
    gameVersions: ["1.21", "1.20.4", "1.20.1"],
    loaders: ["paper", "spigot"],
    name: "Warp Stones",
    slug: "warp-stones",
    summary:
      "Place glowing warp stones that let players travel between named locations.",
    tags: ["teleport", "warps"],
    type: "plugin",
    version: "2.3.0",
  },
  {
    category: "economy",
    downloads: 96_500,
    gameVersions: ["1.21", "1.20.4"],
    loaders: ["paper"],
    name: "Market Stall",
    slug: "market-stall",
    summary: "Chest shops with price history and a simple player-run economy.",
    tags: ["shops", "economy"],
    type: "plugin",
    version: "1.4.2",
  },
  {
    category: "protection",
    downloads: 254_000,
    gameVersions: ["1.21", "1.20.4", "1.20.1", "1.19.4"],
    loaders: ["paper", "spigot"],
    name: "Claim Guard",
    slug: "claim-guard",
    summary:
      "Golden-shovel land claims with trust levels and anti-grief rollback.",
    tags: ["claims", "anti-grief"],
    type: "plugin",
    version: "3.0.1",
  },
  {
    category: "chat",
    downloads: 41_200,
    gameVersions: ["1.21"],
    loaders: ["velocity", "bungeecord"],
    name: "Proxy Chat Bridge",
    slug: "proxy-chat-bridge",
    summary: "Shared chat channels across every server behind your proxy.",
    tags: ["chat", "proxy"],
    type: "plugin",
    version: "0.9.0",
  },
];
