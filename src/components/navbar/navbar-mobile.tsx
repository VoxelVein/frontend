import { IconArticle, IconX } from "@tabler/icons-react";
import { Link, useMatchRoute } from "@tanstack/react-router";

import { AuthButtons } from "@/components/navbar/auth-buttons";
import type { NavbarUser } from "@/components/navbar/auth-buttons";
import {
  CONTENT_LINKS,
  MOBILE_LINK_CLASS,
  MOBILE_SECTION_HEADING_CLASS,
  PROJECT_ITEMS,
} from "@/components/navbar/navbar-links";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";

interface NavbarMobileMenuProps {
  open: boolean;
  onClose: () => void;
  isPending: boolean;
  session: { user: NavbarUser } | null | undefined;
  onSignOut: () => void;
}

const ACTIVE_LINK_CLASS = "bg-primary/10 hover:bg-primary/15";
const ACTIVE_TEXT_CLASS = "text-primary";

const NavbarMobileMenu = ({
  open,
  onClose,
  isPending,
  session,
  onSignOut,
}: NavbarMobileMenuProps) => {
  const matchRoute = useMatchRoute();

  return (
    <Drawer
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onClose();
        }
      }}
      swipeDirection="down"
      showSwipeHandle
    >
      <DrawerContent id="mobile-menu">
        <DrawerHeader className="flex-row items-center justify-between gap-2 text-left">
          <div className="min-w-0">
            <DrawerTitle>Menu</DrawerTitle>
            <DrawerDescription>Navigate VoxelVein</DrawerDescription>
          </div>

          <DrawerClose
            render={
              <Button
                variant="ghost"
                size="icon-lg"
                aria-label="Close menu"
                className="size-11 shrink-0"
              />
            }
          >
            <IconX size={21} stroke={1.8} />
          </DrawerClose>
        </DrawerHeader>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
          <nav
            aria-labelledby="mobile-projects-heading"
            className="flex flex-col"
          >
            {/* Projects first, matching the desktop bar's reading order. The
                drawer lists every section flat regardless of which ones get a
                flat link on desktop, since there is room for them and a nested
                menu would only add a tap. Each row keeps the icon and
                description the desktop Browse menu shows, so the two menus
                describe the same eight destinations the same way. */}
            <h3
              id="mobile-projects-heading"
              className={MOBILE_SECTION_HEADING_CLASS}
            >
              Projects
            </h3>

            {PROJECT_ITEMS.map((item) => {
              const isActive = !!matchRoute({ fuzzy: true, to: item.href });

              return (
                <Link
                  key={item.href}
                  to={item.href}
                  preload="intent"
                  aria-current={isActive ? "page" : undefined}
                  onClick={onClose}
                  className={cn(
                    MOBILE_LINK_CLASS,
                    "items-start gap-3 py-2.5",
                    isActive && ACTIVE_LINK_CLASS
                  )}
                >
                  <item.icon
                    size={18}
                    stroke={1.8}
                    aria-hidden="true"
                    className={cn(
                      "mt-0.5 shrink-0",
                      isActive ? ACTIVE_TEXT_CLASS : "text-muted-foreground"
                    )}
                  />
                  <span className="grid min-w-0 gap-0.5">
                    <span
                      className={cn(
                        "text-sm font-medium",
                        isActive ? ACTIVE_TEXT_CLASS : "text-foreground"
                      )}
                    >
                      {item.label}
                    </span>
                    <span className="text-muted-foreground text-xs leading-snug">
                      {item.description}
                    </span>
                  </span>
                </Link>
              );
            })}
          </nav>

          <nav
            aria-labelledby="mobile-content-heading"
            className="flex flex-col"
          >
            <h3
              id="mobile-content-heading"
              className={MOBILE_SECTION_HEADING_CLASS}
            >
              Content
            </h3>

            {CONTENT_LINKS.map((link) => {
              const isActive = !!matchRoute({ to: link.href });

              return (
                <Link
                  key={link.href}
                  to={link.href}
                  preload="intent"
                  aria-current={isActive ? "page" : undefined}
                  onClick={onClose}
                  className={cn(
                    MOBILE_LINK_CLASS,
                    "gap-3",
                    isActive && "bg-primary/10 text-primary hover:bg-primary/15"
                  )}
                >
                  <IconArticle
                    size={18}
                    stroke={1.8}
                    aria-hidden="true"
                    className={cn(
                      isActive ? "text-primary" : "text-muted-foreground"
                    )}
                  />
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="border-border/70 mt-2 border-t pt-4">
            <AuthButtons
              variant="mobile"
              isPending={isPending}
              session={session}
              onSignOut={onSignOut}
              onClose={onClose}
            />
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export { NavbarMobileMenu };
