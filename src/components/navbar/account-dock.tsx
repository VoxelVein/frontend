import { UserMenu } from "@/components/navbar/user-menu";
import { useSignOut } from "@/hooks/use-sign-out";
import { authClient } from "@/lib/auth-client";

/**
 * The signed-in account button.
 *
 * It lives outside the navbar so it stays reachable on a long page on every
 * screen size. Signed-out visitors keep the navbar's Sign in / Sign up buttons;
 * this dock only appears once there is an account to open.
 */
const AccountDock = () => {
  const { data: session } = authClient.useSession();
  const signOut = useSignOut();

  if (!session?.user) {
    return null;
  }

  return (
    <div className="fixed right-4 bottom-4 z-50">
      <UserMenu user={session.user} onSignOut={signOut} />
    </div>
  );
};

export { AccountDock };
