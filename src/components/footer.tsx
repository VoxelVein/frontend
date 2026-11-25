import { IconBrandDiscord, IconBrandGithub } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";

import { Logo } from "@/components/logo";
import { PROJECT_TYPE_PATHS } from "@/lib/projects";

const DISCORD_URL = "https://discord.gg/hhgQnCfTkT";
const GITHUB_URL = "https://github.com/VoxelVein";
const REPOSITORY_URL = "https://github.com/VoxelVein/frontend";
const LICENSE_URL = `${REPOSITORY_URL}/blob/main/LICENSE`;

/**
 * Read once at module load rather than during render. A render-time read would
 * move the impurity from load to every render, which risks an SSR hydration
 * mismatch for a request crossing a year boundary.
 */
// oxlint-disable-next-line react-doctor/no-impure-call-at-module-scope -- Read once per process, not per render: a render-time read risks SSR hydration mismatches at a year boundary.
const COPYRIGHT_YEAR = new Date().getFullYear();

const QUICK_LINKS = [
  { href: "/", label: "Home" },
  { href: PROJECT_TYPE_PATHS.mod, label: "Explore" },
  { href: "/blog", label: "Blog" },
  { href: "/about", label: "About" },
  { href: "/support", label: "Support" },
] as const;

const LEGAL_LINKS = [
  { href: "/legal", label: "Legal" },
  { href: "/privacy", label: "Privacy" },
  { href: "/cookies", label: "Cookies" },
  { href: "/terms", label: "Terms" },
  { href: "/disclaimer", label: "Disclaimer" },
] as const;

const LINK_CLASS =
  "text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex min-h-9 items-center rounded-md text-xs font-medium transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none motion-reduce:transition-none";

const EXTERNAL_LINK_CLASS =
  "border-border bg-card text-muted-foreground hover:text-primary hover:border-primary/20 focus-visible:ring-ring inline-flex min-h-9 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none motion-reduce:transition-none";

/**
 * A single, compact footer: identity on the left, the places people actually
 * go on the right, and the legal row underneath. The previous four-column grid
 * repeated the navbar and pushed the page down for links nobody was looking
 * for. Discord appears three times on purpose - it is where questions get
 * answered fastest, and it should not require opening a social icon to find.
 */
const Footer = () => (
  <footer className="border-border/70 border-t">
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            to="/"
            aria-label="VoxelVein home"
            className="focus-visible:ring-ring inline-flex min-h-9 items-center rounded-md focus-visible:ring-2 focus-visible:outline-none"
          >
            <Logo className="text-primary size-7" />
          </Link>
          <div className="min-w-0">
            <p className="text-sm font-semibold">VoxelVein</p>
            <p className="text-muted-foreground text-xs">
              © {COPYRIGHT_YEAR} ·{" "}
              <a
                className="hover:text-foreground underline-offset-2 hover:underline"
                href={LICENSE_URL}
                rel="noopener noreferrer"
                target="_blank"
              >
                Apache 2.0
              </a>
            </p>
          </div>
        </div>

        <nav
          aria-label="Footer"
          className="flex flex-wrap items-center gap-x-4 gap-y-1"
        >
          {QUICK_LINKS.map((link) => (
            <Link className={LINK_CLASS} key={link.href} to={link.href}>
              {link.label}
            </Link>
          ))}
          <a
            className={EXTERNAL_LINK_CLASS}
            href={DISCORD_URL}
            rel="noopener noreferrer"
            target="_blank"
          >
            <IconBrandDiscord size={14} aria-hidden="true" />
            Discord
          </a>
          <a
            className={LINK_CLASS}
            href={GITHUB_URL}
            rel="noopener noreferrer"
            target="_blank"
          >
            <IconBrandGithub size={14} aria-hidden="true" />
            GitHub
          </a>
        </nav>
      </div>

      <div className="border-border/60 mt-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t pt-4">
        <p className="text-muted-foreground text-xs">
          Building something with Minecraft?{" "}
          <a
            className="text-foreground underline-offset-2 hover:underline"
            href={DISCORD_URL}
            rel="noopener noreferrer"
            target="_blank"
          >
            Join us on Discord
          </a>
          .
        </p>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {LEGAL_LINKS.map((link) => (
            <Link className={LINK_CLASS} key={link.href} to={link.href}>
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  </footer>
);

export { Footer };
