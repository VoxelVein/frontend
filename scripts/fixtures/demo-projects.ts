import type { ProjectType } from "../../src/lib/projects.ts";

/** Development seed data. Files are generated; these are not real releases. */
export interface DemoProject {
  category: string;
  downloads: number;
  gameVersions: string[];
  loaders: string[];
  name: string;
  /** Join details; only for `server` projects, which have no version. */
  server?: {
    address: string;
    /** Demo projects to link, by slug. */
    links: { required: boolean; slug: string }[];
    port: number | null;
  };
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
  {
    category: "technology",
    downloads: 2_400_000,
    gameVersions: ["1.21.1", "1.21"],
    loaders: ["neoforge"],
    name: "Create: Above and Beyond",
    slug: "create-above-and-beyond",
    summary:
      "A guided tech progression pack built around Create's mechanical automation.",
    tags: ["create", "quests", "progression"],
    type: "modpack",
    version: "2.1.0",
  },
  {
    category: "lightweight",
    downloads: 5_100_000,
    gameVersions: ["1.21.4", "1.21.1", "1.21", "1.20.1"],
    loaders: ["fabric", "quilt"],
    name: "Fabulously Optimized",
    slug: "fabulously-optimized",
    summary:
      "A performance-focused pack that keeps vanilla gameplay while doubling frame rates.",
    tags: ["performance", "vanilla-plus"],
    type: "modpack",
    version: "6.4.0",
  },
  {
    category: "faithful",
    downloads: 8_700_000,
    gameVersions: ["1.21.4", "1.21.1", "1.21", "1.20.4", "1.20.1"],
    loaders: [],
    name: "Faithful 32x",
    slug: "faithful-32x",
    summary:
      "The vanilla look at twice the resolution, redrawn texture by texture.",
    tags: ["32x", "vanilla"],
    type: "resourcepack",
    version: "1.21.4-r1",
  },
  {
    category: "utility",
    downloads: 1_300_000,
    gameVersions: ["1.21.4", "1.21.1", "1.21", "1.20.1"],
    loaders: [],
    name: "Fresh Animations",
    slug: "fresh-animations",
    summary: "Brings mobs to life with smoother, more expressive animations.",
    tags: ["animations", "entities"],
    type: "resourcepack",
    version: "1.9.2",
  },
  {
    category: "realistic",
    downloads: 6_200_000,
    gameVersions: ["1.21.4", "1.21.1", "1.21", "1.20.4", "1.20.1"],
    loaders: ["iris", "optifine"],
    name: "Complementary Reimagined",
    slug: "complementary-reimagined",
    summary:
      "Soft lighting and rich atmosphere that stays true to Minecraft's style.",
    tags: ["lighting", "atmosphere"],
    type: "shader",
    version: "r5.4",
  },
  {
    category: "performance",
    downloads: 3_900_000,
    gameVersions: ["1.21.4", "1.21.1", "1.21", "1.20.1"],
    loaders: ["iris"],
    name: "Sildur's Enhanced Default",
    slug: "sildurs-enhanced-default",
    summary: "Light-weight shaders that run well on older graphics cards.",
    tags: ["lightweight", "fps"],
    type: "shader",
    version: "1.14",
  },
  {
    category: "modded",
    downloads: 0,
    gameVersions: ["1.21.1", "1.21"],
    loaders: [],
    name: "Brass & Steam SMP",
    server: {
      address: "play.brass-steam.example",
      links: [{ required: true, slug: "create-above-and-beyond" }],
      port: null,
    },
    slug: "brass-and-steam-smp",
    summary:
      "A friendly modded survival server running Create: Above and Beyond.",
    tags: ["smp", "create", "whitelist"],
    type: "server",
    version: "",
  },
  {
    category: "minigames",
    downloads: 0,
    gameVersions: ["1.21.4", "1.21.1", "1.21", "1.20.4", "1.20.1"],
    loaders: [],
    name: "Pixel Party",
    server: {
      address: "mc.pixelparty.example",
      links: [],
      port: 25_570,
    },
    slug: "pixel-party",
    summary: "Quick rounds of parkour, spleef, and build battles for everyone.",
    tags: ["minigames", "parkour"],
    type: "server",
    version: "",
  },
  {
    category: "survival",
    downloads: 0,
    gameVersions: ["1.21.4", "1.21.1", "1.21"],
    loaders: [],
    name: "Golden Hour Survival",
    server: {
      address: "goldenhour.example",
      links: [
        { required: false, slug: "complementary-reimagined" },
        { required: false, slug: "fresh-animations" },
        { required: false, slug: "sodium" },
      ],
      port: null,
    },
    slug: "golden-hour-survival",
    summary:
      "Vanilla survival with a recommended set of shaders and visual mods.",
    tags: ["survival", "shaders"],
    type: "server",
    version: "",
  },
];
