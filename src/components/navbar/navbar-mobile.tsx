import { IconX } from "@tabler/icons-react";
import { Link, useMatchRoute } from "@tanstack/react-router";

import { AuthButtons } from "@/components/navbar/auth-buttons";
import type { NavbarUser } from "@/components/navbar/auth-buttons";
import { CONTENT_LINKS, PROJECT_ITEMS } from "@/components/navbar/navbar-links";
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

const mobileLinkClassName =
  "text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring min-h-11 flex items-center rounded-lg px-3 py-3 text-sm font-medium transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none";

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
          <nav aria-label="Content navigation" className="flex flex-col">
            <p className="text-muted-foreground mb-2 px-3 py-2 text-xs font-semibold tracking-wider uppercase">
              Content
            </p>

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
                    mobileLinkClassName,
                    isActive && "bg-muted text-foreground"
                  )}
                >
                  {link.label}
                </Link>
              );
            })}

            <p className="text-muted-foreground mt-4 mb-2 px-3 py-2 text-xs font-semibold tracking-wider uppercase">
              Projects
            </p>

            {PROJECT_ITEMS.map((item) => {
              // SAFETY: Only available items render a Link; unavailable routes are not registered yet.
              const href = item.href as "/mods";
              const isActive = !!matchRoute({ to: href });

              if (!item.available) {
                return (
                  <span
                    key={item.href}
                    className="text-muted-foreground/70 flex min-h-11 items-center justify-between rounded-lg px-3 py-3 text-sm font-medium"
                  >
                    {item.label}
                    <span className="text-xs">Soon</span>
                  </span>
                );
              }

              return (
                <Link
                  key={item.href}
                  to={href}
                  preload="intent"
                  aria-current={isActive ? "page" : undefined}
                  onClick={onClose}
                  className={cn(
                    mobileLinkClassName,
                    isActive && "bg-muted text-foreground"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <AuthButtons
            variant="mobile"
            isPending={isPending}
            session={session}
            onSignOut={onSignOut}
          />
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export { NavbarMobileMenu };
