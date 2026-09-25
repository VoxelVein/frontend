import {
  IconBox,
  IconChevronDown,
  IconDeviceGamepad2,
  IconPackages,
  IconPalette,
  IconPhoto,
  IconServer,
} from "@tabler/icons-react";
import { Link, useMatchRoute } from "@tanstack/react-router";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const CONTENT_LINKS = [{ href: "/blog", label: "Blog" }] as const;

const PROJECT_ITEMS: readonly {
  available: boolean;
  description: string;
  href: string;
  icon: typeof IconBox;
  label: string;
}[] = [
  {
    available: true,
    description: "Browse Minecraft mods",
    href: "/mods",
    icon: IconBox,
    label: "Mods",
  },
  {
    available: false,
    description: "Curated mod collections",
    href: "/modpacks",
    icon: IconPackages,
    label: "Modpacks",
  },
  {
    available: true,
    description: "Server-side plugins",
    href: "/plugins",
    icon: IconServer,
    label: "Plugins",
  },
  {
    available: false,
    description: "Visual and audio packs",
    href: "/resource-packs",
    icon: IconDeviceGamepad2,
    label: "Resource Packs",
  },
  {
    available: false,
    description: "Stunning visual effects",
    href: "/shaders",
    icon: IconPalette,
    label: "Shaders",
  },
  {
    available: false,
    description: "Communities and worlds",
    href: "/servers",
    icon: IconPhoto,
    label: "Servers",
  },
];

const linkClassName =
  "text-muted-foreground hover:bg-muted/50 hover:text-foreground focus-visible:ring-ring inline-flex min-h-11 items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none";

const activeLinkClassName = "bg-muted text-foreground";

const NavbarLinks = () => {
  const matchRoute = useMatchRoute();
  const isProjectsActive = !!matchRoute({ to: "/mods" });

  return (
    <nav
      aria-label="Main navigation"
      className="hidden items-center gap-1 lg:flex"
    >
      {CONTENT_LINKS.map((link) => {
        const isActive = !!matchRoute({ to: link.href });

        return (
          <Link
            key={link.href}
            to={link.href}
            preload="intent"
            aria-current={isActive ? "page" : undefined}
            className={cn(linkClassName, isActive && activeLinkClassName)}
          >
            {link.label}
          </Link>
        );
      })}

      <DropdownMenu>
        <DropdownMenuTrigger
          render={(props) => (
            <button
              type="button"
              aria-current={isProjectsActive ? "page" : undefined}
              className={cn(
                linkClassName,
                isProjectsActive && activeLinkClassName
              )}
              {...props}
            />
          )}
        >
          Projects
          <IconChevronDown
            size={15}
            stroke={1.8}
            aria-hidden="true"
            className="text-muted-foreground transition-transform duration-200 group-data-popup-open:rotate-180"
          />
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" sideOffset={8} className="min-w-64">
          {PROJECT_ITEMS.map((item) => {
            const icon = (
              <item.icon size={16} stroke={1.8} aria-hidden="true" />
            );

            if (!item.available) {
              return (
                <DropdownMenuItem
                  key={item.href}
                  disabled
                  className="text-muted-foreground flex w-full cursor-default items-center gap-2 rounded-lg px-3 py-2.5 text-sm"
                >
                  {icon}
                  <span className="flex-1">{item.label}</span>
                  <span className="text-muted-foreground/70 text-xs">Soon</span>
                </DropdownMenuItem>
              );
            }

            return (
              <DropdownMenuItem
                key={item.href}
                render={<Link to={item.href} preload="intent" />}
                className="text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring data-highlighted:bg-muted data-highlighted:text-foreground flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
              >
                {icon}
                <span className="flex flex-col">
                  <span className="text-foreground">{item.label}</span>
                  <span className="text-muted-foreground text-xs">
                    {item.description}
                  </span>
                </span>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </nav>
  );
};

export { CONTENT_LINKS, NavbarLinks, PROJECT_ITEMS };
