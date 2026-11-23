import {
  IconArrowUp,
  IconBrandDiscord,
  IconBrandGithub,
  IconLicense,
} from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";

import { Logo } from "@/components/logo";
import { PROJECT_TYPE_PATHS } from "@/lib/projects";

interface FooterLink {
  available: boolean;
  href: string;
  label: string;
}

const PROJECT_LINKS: readonly FooterLink[] = [
  { available: true, href: PROJECT_TYPE_PATHS.mod, label: "Mods" },
  { available: true, href: PROJECT_TYPE_PATHS.modpack, label: "Modpacks" },
  { available: true, href: PROJECT_TYPE_PATHS.plugin, label: "Plugins" },
  {
    available: true,
    href: PROJECT_TYPE_PATHS.resourcepack,
    label: "Resource Packs",
  },
  { available: true, href: PROJECT_TYPE_PATHS.shader, label: "Shaders" },
  { available: true, href: PROJECT_TYPE_PATHS.server, label: "Servers" },
  { available: true, href: PROJECT_TYPE_PATHS.datapack, label: "Datapacks" },
];

const RESOURCE_LINKS: readonly FooterLink[] = [
  { available: false, href: "/docs", label: "Documentation" },
  { available: false, href: "/api", label: "API" },
  { available: false, href: "/status", label: "Status" },
  { available: false, href: "/changelog", label: "Changelog" },
];

const COMPANY_LINKS: readonly FooterLink[] = [
  { available: true, href: "/about", label: "About" },
  { available: true, href: "/blog", label: "Blog" },
  { available: true, href: "/support", label: "Support" },
  { available: false, href: "/contact", label: "Contact" },
  { available: false, href: "/brand", label: "Brand" },
];

const SOCIAL_LINKS = [
  {
    href: "https://github.com/VoxelVein",
    icon: IconBrandGithub,
    label: "GitHub",
  },
  {
    href: "https://discord.gg/6JKttcu9cc",
    icon: IconBrandDiscord,
    label: "Discord",
  },
] as const;

const REPOSITORY_URL = "https://github.com/VoxelVein/frontend";
const LICENSE_URL = `${REPOSITORY_URL}/blob/main/LICENSE`;

/**
 * Read once at module load rather than during render.
 *
 * `new Date()` inside the component made render impure, and impure render is
 * how SSR hydration mismatches start: the server stamps its year into the
 * HTML and the client re-renders with its own, and the two disagree for any
 * request that crosses midnight or a New Year between the two. Module scope
 * gives one value per process, so both sides agree. Reading the clock during
 * render would move the impurity the lint objects to from load time to every
 * render, which is exactly the hydration hazard this avoids, so the deliberate
 * module-scope read is suppressed rather than relocated.
 */
// oxlint-disable-next-line react-doctor/no-impure-call-at-module-scope -- Read once per process, not per render: a render-time read risks SSR hydration mismatches at a year boundary.
const COPYRIGHT_YEAR = new Date().getFullYear();

const LINK_CLASS =
  "text-muted-foreground hover:text-foreground focus-visible:ring-ring ease-smooth inline-flex min-h-11 items-center text-sm font-medium transition-colors duration-200 focus-visible:ring-2 focus-visible:outline-none motion-reduce:transition-none";

const COLUMN_HEADING_CLASS =
  "text-muted-foreground mb-2 text-xs font-semibold tracking-wider uppercase";

const FooterLinkItem = ({ link }: { link: FooterLink }) => {
  if (!link.available) {
    return (
      <span className="text-muted-foreground/35 inline-flex min-h-11 cursor-not-allowed items-center gap-2 text-sm select-none">
        {link.label}
        <span className="text-muted-foreground/25 text-xs font-normal">
          Soon
        </span>
      </span>
    );
  }

  return (
    <Link to={link.href} preload="intent" className={LINK_CLASS}>
      {link.label}
    </Link>
  );
};

const Footer = () => (
  <footer className="border-border bg-muted/25 border-t">
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(0,1fr))]">
        {/* Branding */}
        <div className="col-span-2 sm:col-span-3 lg:col-span-1">
          <Link
            to="/"
            aria-label="VoxelVein home"
            className="group focus-visible:ring-ring inline-flex min-h-11 items-center gap-2 rounded-md focus-visible:ring-2 focus-visible:outline-none"
          >
            <Logo className="ease-smooth text-primary group-hover:text-primary/80 size-8 transition-colors duration-200 motion-reduce:transition-none" />
            <span className="text-lg font-semibold tracking-tight">
              VoxelVein
            </span>
          </Link>

          <p className="text-muted-foreground mt-3 max-w-xs text-sm leading-6">
            The free, open-source platform for finding, downloading, and sharing
            Minecraft content.
          </p>

          <div className="mt-4 flex items-center gap-2">
            {SOCIAL_LINKS.map((social) => (
              <a
                key={social.label}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={social.label}
                className="border-border bg-card text-muted-foreground hover:text-primary hover:border-primary/20 focus-visible:ring-ring ease-smooth inline-flex size-11 items-center justify-center rounded-lg border transition-colors duration-200 focus-visible:ring-2 focus-visible:outline-none motion-reduce:transition-none"
              >
                <social.icon size={18} aria-hidden="true" />
              </a>
            ))}
          </div>

          <a
            href={LICENSE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="border-border bg-primary/5 text-primary hover:border-primary/30 hover:bg-primary/10 focus-visible:ring-ring ease-smooth mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors duration-200 focus-visible:ring-2 focus-visible:outline-none motion-reduce:transition-none"
          >
            <IconLicense size={16} aria-hidden="true" />
            Apache 2.0
          </a>
        </div>

        {/* Projects */}
        <nav aria-labelledby="footer-projects-heading">
          <h3 className={COLUMN_HEADING_CLASS} id="footer-projects-heading">
            Explore
          </h3>
          <ul>
            {PROJECT_LINKS.map((link) => (
              <li key={link.href}>
                <FooterLinkItem link={link} />
              </li>
            ))}
          </ul>
        </nav>

        {/* Resources */}
        <nav aria-labelledby="footer-resources-heading">
          <h3 className={COLUMN_HEADING_CLASS} id="footer-resources-heading">
            Resources
          </h3>
          <ul>
            {RESOURCE_LINKS.map((link) => (
              <li key={link.href}>
                <FooterLinkItem link={link} />
              </li>
            ))}
          </ul>
        </nav>

        {/* Company */}
        <nav aria-labelledby="footer-company-heading">
          <h3 className={COLUMN_HEADING_CLASS} id="footer-company-heading">
            Company
          </h3>
          <ul>
            {COMPANY_LINKS.map((link) => (
              <li key={link.href}>
                <FooterLinkItem link={link} />
              </li>
            ))}
          </ul>
        </nav>
      </div>

      {/* Bottom bar */}
      <div className="border-border/70 mt-10 flex flex-col gap-4 border-t pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground text-sm">
          © {COPYRIGHT_YEAR} VoxelVein. Open source under{" "}
          <a
            href={LICENSE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground focus-visible:ring-ring rounded-sm underline-offset-4 transition-colors duration-200 hover:underline focus-visible:ring-2 focus-visible:outline-none motion-reduce:transition-none"
          >
            Apache 2.0
          </a>
          .
        </p>

        <div className="flex flex-col items-start gap-2 sm:items-end">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <Link to="/legal" className={LINK_CLASS}>
              Legal Notes
            </Link>
            <Link to="/privacy" className={LINK_CLASS}>
              Privacy
            </Link>
            <Link to="/cookies" className={LINK_CLASS}>
              Cookies
            </Link>
            <Link to="/terms" className={LINK_CLASS}>
              Terms
            </Link>
            <Link to="/disclaimer" className={LINK_CLASS}>
              Disclaimer
            </Link>
          </div>

          <a
            href="#main-content"
            className="text-muted-foreground hover:text-foreground focus-visible:ring-ring ease-smooth inline-flex min-h-11 items-center gap-1.5 rounded-md px-1 text-sm font-medium transition-colors duration-200 focus-visible:ring-2 focus-visible:outline-none motion-reduce:transition-none"
          >
            <IconArrowUp size={15} aria-hidden="true" />
            Back to top
          </a>
        </div>
      </div>
    </div>
  </footer>
);

export { Footer };
