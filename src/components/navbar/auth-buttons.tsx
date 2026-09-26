import { Link } from "@tanstack/react-router";

import { UserMenu } from "@/components/navbar/user-menu";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { Skeleton } from "@/components/ui/skeleton";
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
}

const AuthSkeleton = ({ variant }: { variant: "desktop" | "mobile" }) => (
  <Skeleton
    className={cn(variant === "desktop" ? "h-10 w-24" : "mt-3 h-11 w-full")}
  />
);

const AuthSignIn = ({ variant }: { variant: "desktop" | "mobile" }) => (
  <Link
    to="/login"
    className={cn(
      buttonVariants({ size: "sm", variant: "default" }),
      variant === "desktop" ? "min-h-10 px-4" : "mt-3 min-h-11 w-full"
    )}
  >
    Sign In
  </Link>
);

const MobileUserCard = ({
  user,
  onSignOut,
}: {
  user: NavbarUser;
  onSignOut: () => void;
}) => (
  <div className="border-border bg-muted/40 mt-3 flex items-center gap-3 rounded-lg border p-3">
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
      Sign Out
    </Button>
  </div>
);

const AuthSignedIn = ({
  variant,
  user,
  onSignOut,
}: {
  variant: "desktop" | "mobile";
  user: NavbarUser;
  onSignOut: () => void;
}) => {
  if (variant === "desktop") {
    return <UserMenu user={user} onSignOut={onSignOut} />;
  }
  return <MobileUserCard user={user} onSignOut={onSignOut} />;
};

const AuthButtons = ({
  variant,
  isPending,
  session,
  onSignOut,
}: AuthButtonsProps) => {
  if (isPending) {
    return <AuthSkeleton variant={variant} />;
  }

  if (session) {
    return (
      <AuthSignedIn
        variant={variant}
        user={session.user}
        onSignOut={onSignOut}
      />
    );
  }

  return <AuthSignIn variant={variant} />;
};

export { AuthButtons };
export type { NavbarUser };
