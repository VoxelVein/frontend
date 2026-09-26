import {
  IconBox,
  IconBrandDiscord,
  IconBrandGithub,
  IconLicense,
} from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";

interface FooterLink {
  available: boolean;
  href: string;
  label: string;
}

const PROJECT_LINKS: readonly FooterLink[] = [
  { available: true, href: "/mods", label: "Mods" },
  { available: false, href: "/modpacks", label: "Modpacks" },
  { available: true, href: "/plugins", label: "Plugins" },
  { available: false, href: "/resource-packs", label: "Resource Packs" },
  { available: false, href: "/shaders", label: "Shaders" },
  { available: false, href: "/servers", label: "Servers" },
];

const RESOURCE_LINKS: readonly FooterLink[] = [
  { available: false, href: "/docs", label: "Documentation" },
  { available: false, href: "/api", label: "API" },
  { available: false, href: "/status", label: "Status" },
  { available: false, href: "/changelog", label: "Changelog" },
];

const COMPANY_LINKS: readonly FooterLink[] = [
  { available: false, href: "/about", label: "About" },
  { available: true, href: "/blog", label: "Blog" },
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

const LINK_CLASS =
  "text-muted-foreground hover:text-foreground focus-visible:ring-ring ease-smooth inline-flex min-h-11 items-center text-sm font-medium transition-colors duration-200 focus-visible:ring-2 focus-visible:outline-none motion-reduce:transition-none";

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
  <footer className="border-border bg-muted/30 border-t">
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-5">
        {/* Branding */}
        <div className="sm:col-span-2">
          <Link
            to="/"
            className="focus-visible:ring-ring inline-flex min-h-11 items-center gap-2 rounded-md focus-visible:ring-2 focus-visible:outline-none"
          >
            <IconBox size={24} className="text-primary" />
            <span className="text-lg font-semibold tracking-tight">
              VoxelVein
            </span>
          </Link>
          <p className="text-muted-foreground mt-3 max-w-xs text-sm">
            The free, open-source platform for discovering, managing, and
            sharing Minecraft content.
          </p>
          <div className="mt-4 flex items-center gap-2">
            {SOCIAL_LINKS.map((social) => (
              <a
                key={social.label}
                href={social.href}
                target="_blank"
                rel="noopener"
                aria-label={social.label}
                className="border-border bg-card text-muted-foreground hover:text-primary hover:border-primary/20 focus-visible:ring-ring ease-smooth inline-flex size-11 items-center justify-center rounded-lg border transition-colors duration-200 focus-visible:ring-2 focus-visible:outline-none motion-reduce:transition-none"
              >
                <social.icon size={18} />
              </a>
            ))}
          </div>
          <div className="border-border bg-primary/5 text-primary mt-4 inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium">
            <IconLicense size={16} />
            Open source
          </div>
        </div>

        {/* Projects */}
        <nav aria-label="Project links">
          <h3 className="mb-3 text-sm font-semibold">Projects</h3>
          <ul className="space-y-1">
            {PROJECT_LINKS.map((link) => (
              <li key={link.href}>
                <FooterLinkItem link={link} />
              </li>
            ))}
          </ul>
        </nav>

        {/* Resources */}
        <nav aria-label="Resource links">
          <h3 className="mb-3 text-sm font-semibold">Resources</h3>
          <ul className="space-y-1">
            {RESOURCE_LINKS.map((link) => (
              <li key={link.href}>
                <FooterLinkItem link={link} />
              </li>
            ))}
          </ul>
        </nav>

        {/* Company */}
        <nav aria-label="Company links">
          <h3 className="mb-3 text-sm font-semibold">Company</h3>
          <ul className="space-y-1">
            {COMPANY_LINKS.map((link) => (
              <li key={link.href}>
                <FooterLinkItem link={link} />
              </li>
            ))}
          </ul>
        </nav>
      </div>

      {/* Bottom bar */}
      <div className="border-border mt-8 flex flex-col items-center justify-between gap-4 border-t pt-6 sm:flex-row">
        <p className="text-muted-foreground text-sm">
          © {new Date().getFullYear()} VoxelVein. All rights reserved.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 sm:justify-end">
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
          <Link to="/terms-of-use" className={LINK_CLASS}>
            Terms of Use
          </Link>
          <Link to="/disclaimer" className={LINK_CLASS}>
            Disclaimer
          </Link>
        </div>
      </div>
    </div>
  </footer>
);

export { Footer };
