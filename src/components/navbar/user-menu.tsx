import {
  IconArrowsExchange,
  IconBell,
  IconHelp,
  IconLogout,
  IconPackage,
  IconSettings,
  IconShield,
} from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { Avatar } from "@/components/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { can } from "@/lib/roles";

interface UserMenuUser {
  name: string;
  email?: string | null;
  image?: string | null;
  role?: string | null;
}

interface UserMenuProps {
  user: UserMenuUser;
  onSignOut: () => void;
}

/**
 * Every row in the account popup shares one treatment.
 *
 * The previous menu repeated the same long className five times, which is how
 * one row drifted into a different hover colour. Keeping it here also keeps the
 * destructive sign-out row as the only deliberate variation.
 */
const MENU_ITEM_CLASS =
  "text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring data-highlighted:bg-muted data-highlighted:text-foreground flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none";

interface MenuLinkProps {
  children: ReactNode;
  icon: ReactNode;
  to: string;
}

const MenuLink = ({ children, icon, to }: MenuLinkProps) => (
  <DropdownMenuItem render={<Link to={to} />} className={MENU_ITEM_CLASS}>
    {icon}
    {children}
  </DropdownMenuItem>
);

/**
 * The account popup, opened from the small avatar button fixed to the corner.
 *
 * The trigger is an icon-only button, so the name is carried by the tooltip for
 * sighted pointer users and by `aria-label` for everyone else. The popup itself
 * is deliberately short: the destinations that matter, then sign out.
 */
const UserMenu = ({ user, onSignOut }: UserMenuProps) => (
  <DropdownMenu>
    <Tooltip>
      <DropdownMenuTrigger
        render={
          <TooltipTrigger
            render={
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="border-border/70 bg-background/90 hover:bg-muted size-11 rounded-full p-0 shadow-lg backdrop-blur-sm"
              />
            }
          />
        }
        aria-label={`Account menu for ${user.name}`}
      >
        <Avatar
          decorative={false}
          image={user.image ?? null}
          name={user.name}
        />
      </DropdownMenuTrigger>
      <TooltipContent side="top">{user.name}</TooltipContent>
    </Tooltip>

    <DropdownMenuContent align="end" sideOffset={12} className="min-w-56">
      <DropdownMenuGroup>
        <DropdownMenuLabel className="border-border/70 mb-1 border-b px-3 py-2">
          <p className="text-foreground truncate text-sm font-medium">
            {user.name}
          </p>
          {user.email ? (
            <p className="text-muted-foreground truncate text-xs">
              {user.email}
            </p>
          ) : null}
        </DropdownMenuLabel>
      </DropdownMenuGroup>

      <MenuLink
        icon={<IconPackage size={16} stroke={1.8} aria-hidden="true" />}
        to="/dashboard/projects"
      >
        My projects
      </MenuLink>
      <MenuLink
        icon={<IconArrowsExchange size={16} stroke={1.8} aria-hidden="true" />}
        to="/dashboard/transfers"
      >
        Transfers
      </MenuLink>
      <MenuLink
        icon={<IconBell size={16} stroke={1.8} aria-hidden="true" />}
        to="/notifications"
      >
        Notifications
      </MenuLink>
      <MenuLink
        icon={<IconHelp size={16} stroke={1.8} aria-hidden="true" />}
        to="/support"
      >
        Support
      </MenuLink>
      <MenuLink
        icon={<IconSettings size={16} stroke={1.8} aria-hidden="true" />}
        to="/settings"
      >
        Settings
      </MenuLink>

      {can(user.role, "viewAdminPanel") ? (
        <MenuLink
          icon={<IconShield size={16} stroke={1.8} aria-hidden="true" />}
          to="/admin"
        >
          Admin panel
        </MenuLink>
      ) : null}

      <DropdownMenuSeparator className="border-border/70 my-1 border-t" />

      <DropdownMenuItem
        onClick={onSignOut}
        className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive focus-visible:ring-ring focus-visible:ring-destructive/50 data-highlighted:bg-destructive/10 data-highlighted:text-destructive flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
      >
        <IconLogout size={16} stroke={1.8} aria-hidden="true" />
        Sign out
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
);

export { UserMenu };
