import {
  IconBell,
  IconBox,
  IconCompass,
  IconDeviceGamepad2,
  IconDownload,
  IconPackages,
  IconSearch,
  IconServer,
  IconUsers,
  IconWallet,
} from "@tabler/icons-react";
import { createFileRoute } from "@tanstack/react-router";

import { FeatureSection } from "@/components/feature-section";
import { Hero } from "@/components/hero";
import { NewsSection } from "@/components/news-section";
import { TechStack } from "@/components/tech-stack";

const PLAYER_FEATURES = [
  {
    icon: IconSearch,
    title: "Powerful Search",
    description:
      "Find mods, modpacks, resource packs, shaders, plugins, and more with fast search and powerful filters.",
  },
  {
    icon: IconDownload,
    title: "Easy Installation",
    description:
      "Discover projects and install the content you need through supported Minecraft launchers.",
  },
  {
    icon: IconBell,
    title: "Stay Updated",
    description:
      "Follow your favorite projects and keep up with new releases and important updates.",
  },
];

const CREATOR_FEATURES = [
  {
    icon: IconCompass,
    title: "Project Discovery",
    description:
      "Help players discover your projects through search, categories, tags, and recommendations.",
  },
  {
    icon: IconUsers,
    title: "Team Collaboration",
    description:
      "Work together with your team, manage members, and organize your projects from one place.",
  },
  {
    icon: IconWallet,
    title: "Creator Support",
    description:
      "Build an audience around your work with transparent and creator-friendly platform features.",
  },
];

const BROWSE_FEATURES = [
  {
    icon: IconBox,
    title: "Mods",
    description: "Enhance Minecraft with new features, mechanics, and content.",
  },
  {
    icon: IconPackages,
    title: "Modpacks",
    description: "Discover curated collections of mods for every playstyle.",
  },
  {
    icon: IconServer,
    title: "Plugins",
    description: "Extend your Minecraft server with powerful plugins.",
  },
  {
    icon: IconDeviceGamepad2,
    title: "Resource Packs",
    description: "Change the look and feel of your Minecraft experience.",
  },
];

const HomePage = () => (
  <>
    <Hero />
    <TechStack />
    <FeatureSection
      id="browse"
      headingId="browse-heading"
      title="Explore Minecraft"
      description="Discover projects made by the community for the way you play Minecraft."
      features={BROWSE_FEATURES}
    />
    <FeatureSection
      id="for-players"
      headingId="for-players-heading"
      title="Built for Players"
      description="Everything you need to discover, manage, and enjoy Minecraft content."
      features={PLAYER_FEATURES}
    />
    <FeatureSection
      id="for-creators"
      headingId="for-creators-heading"
      title="Built for Creators"
      description="Simple and powerful tools for publishing and growing your Minecraft projects."
      features={CREATOR_FEATURES}
    />
    <NewsSection />
  </>
);

export const Route = createFileRoute("/")({
  component: HomePage,
});
