import {
  IconArrowsExchange,
  IconHelp,
  IconLogin2,
  IconPackage,
  IconSettings,
  IconShield,
  IconUserPlus,
} from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";

import {
  MOBILE_LINK_CLASS,
  MOBILE_SECTION_HEADING_CLASS,
} from "@/components/navbar/navbar-links";
import { UserNotifications } from "@/components/navbar/user-notifications";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { buttonVariants } from "@/components/ui/button-variants";
import { Skeleton } from "@/components/ui/skeleton";
import { can } from "@/lib/roles";
import { cn } from "@/lib/utils";

interface NavbarUser {
  name: string;
  email?: string | null;
  image?: string | null;
  role?: string | null;
}

interface AuthButtonsProps {
  variant: "desktop" | "mobile";
  isPending: boolean;
  session: { user: NavbarUser } | null | undefined;
  onSignOut: () => void;
  /** Closes the mobile drawer after an account link navigates. */
  onClose?: () => void;
}

const AuthSkeleton = ({ variant }: { variant: "desktop" | "mobile" }) => (
  <Skeleton
    className={cn(variant === "desktop" ? "h-10 w-36" : "mt-3 h-11 w-full")}
  />
);

const AuthSignIn = ({ variant }: { variant: "desktop" | "mobile" }) => (
  <ButtonGroup
    aria-label="Account"
    className={cn(
      variant === "desktop" ? "min-h-10" : "mt-3 min-h-11 w-full *:flex-1"
    )}
  >
    <Link
      to="/login"
      data-slot="button"
      className={cn(
        buttonVariants({ size: "sm", variant: "default" }),
        variant === "desktop" ? "min-h-10 px-3" : "min-h-11"
      )}
    >
      <IconLogin2 aria-hidden="true" />
      Sign in
    </Link>
    <Link
      to="/signup"
      data-slot="button"
      className={cn(
        buttonVariants({ size: "sm", variant: "outline" }),
        variant === "desktop" ? "min-h-10 px-3" : "min-h-11"
      )}
    >
      <IconUserPlus aria-hidden="true" />
      Sign up
    </Link>
  </ButtonGroup>
);

const MobileUserCard = ({
  user,
  onSignOut,
}: {
  user: NavbarUser;
  onSignOut: () => void;
}) => (
  <div className="border-border bg-muted/40 flex items-center gap-3 rounded-lg border p-3">
    {user.image ? (
      <img
        src={user.image}
        alt={`${user.name}'s avatar`}
        className="size-9 rounded-full object-cover"
      />
    ) : (
      <span
        aria-hidden="true"
        className="bg-primary text-primary-foreground flex size-9 items-center justify-center rounded-full text-sm font-semibold"
      >
        {user.name.charAt(0).toUpperCase()}
      </span>
    )}

    <div className="min-w-0 flex-1">
      <p className="text-foreground truncate text-sm font-medium">
        {user.name}
      </p>
      <p className="text-muted-foreground truncate text-xs">{user.email}</p>
    </div>

    <Button
      type="button"
      variant="outline"
      size="sm"
      className="min-h-11"
      onClick={onSignOut}
    >
      Sign out
    </Button>
  </div>
);

/**
 * The signed-in drawer's account destinations.
 *
 * The desktop bar hides these inside two popups: the notification bell and the
 * avatar menu. A drawer has room to list them, so the same destinations stay
 * reachable without opening a popup, including the admin panel that moderators
 * need on a phone.
 */
const MobileAccountLinks = ({
  onClose,
  user,
}: {
  onClose?: () => void;
  user: NavbarUser;
}) => (
  <nav aria-labelledby="mobile-account-heading" className="mt-3 flex flex-col">
    <h3 className={MOBILE_SECTION_HEADING_CLASS} id="mobile-account-heading">
      Account
    </h3>

    <UserNotifications variant="mobile" />

    <Link
      className={cn(MOBILE_LINK_CLASS, "gap-3")}
      onClick={onClose}
      preload="intent"
      to="/dashboard/projects"
    >
      <IconPackage
        aria-hidden="true"
        className="text-muted-foreground shrink-0"
        size={18}
        stroke={1.8}
      />
      My projects
    </Link>

    <Link
      className={cn(MOBILE_LINK_CLASS, "gap-3")}
      onClick={onClose}
      preload="intent"
      to="/dashboard/transfers"
    >
      <IconArrowsExchange
        aria-hidden="true"
        className="text-muted-foreground shrink-0"
        size={18}
        stroke={1.8}
      />
      Transfers
    </Link>

    <Link
      className={cn(MOBILE_LINK_CLASS, "gap-3")}
      onClick={onClose}
      preload="intent"
      to="/support"
    >
      <IconHelp
        aria-hidden="true"
        className="text-muted-foreground shrink-0"
        size={18}
        stroke={1.8}
      />
      Support
    </Link>

    <Link
      className={cn(MOBILE_LINK_CLASS, "gap-3")}
      onClick={onClose}
      preload="intent"
      to="/settings"
    >
      <IconSettings
        aria-hidden="true"
        className="text-muted-foreground shrink-0"
        size={18}
        stroke={1.8}
      />
      Settings
    </Link>

    {can(user.role, "viewAdminPanel") ? (
      <Link
        className={cn(MOBILE_LINK_CLASS, "gap-3")}
        onClick={onClose}
        preload="intent"
        to="/admin"
      >
        <IconShield
          aria-hidden="true"
          className="text-muted-foreground shrink-0"
          size={18}
          stroke={1.8}
        />
        Admin panel
      </Link>
    ) : null}
  </nav>
);

const AuthSignedIn = ({
  variant,
  user,
  onSignOut,
  onClose,
}: {
  variant: "desktop" | "mobile";
  user: NavbarUser;
  onSignOut: () => void;
  onClose?: () => void;
}) => {
  if (variant === "desktop") {
    // The account menu moved to the floating avatar button in the corner; the
    // navbar keeps the bell, which is still the fastest route to the inbox.
    return <UserNotifications />;
  }

  return (
    <div className="mt-3 grid gap-2">
      <MobileUserCard user={user} onSignOut={onSignOut} />
      <MobileAccountLinks onClose={onClose} user={user} />
    </div>
  );
};

const AuthButtons = ({
  variant,
  isPending,
  session,
  onSignOut,
  onClose,
}: AuthButtonsProps) => {
  if (isPending) {
    return <AuthSkeleton variant={variant} />;
  }

  if (session?.user) {
    return (
      <AuthSignedIn
        variant={variant}
        user={session.user}
        onSignOut={onSignOut}
        onClose={onClose}
      />
    );
  }

  return <AuthSignIn variant={variant} />;
};

export { AuthButtons };

export type { NavbarUser };
