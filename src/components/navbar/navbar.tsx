import { IconMenu2, IconX } from "@tabler/icons-react";
import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { ThemeToggle } from "@/components/motion/theme-toggle";
import { AuthButtons } from "@/components/navbar/auth-buttons";
import { NavbarLinks } from "@/components/navbar/navbar-links";
import { NavbarLogo } from "@/components/navbar/navbar-logo";
import { NavbarMobileMenu } from "@/components/navbar/navbar-mobile";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

const Navbar = () => {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const { data: session, isPending } = authClient.useSession();

  const handleSignOut = async () => {
    try {
      const { error } = await authClient.signOut();
      if (error) {
        toast.error(error.message ?? "Could not sign out.", {
          action: {
            label: "Try again",
            onClick: () => handleSignOut(),
          },
        });
        return;
      }
    } catch {
      toast.error("Could not sign out.", {
        action: {
          label: "Try again",
          onClick: () => handleSignOut(),
        },
      });
      return;
    }

    setMenuOpen(false);
    // Force the session hook to refetch so the UI reflects the signed-out state
    authClient.$store.notify("$sessionSignal");
    router.invalidate();
    router.navigate({ to: "/" });
  };

  return (
    <header className="border-border/70 bg-background sticky top-0 z-50 border-b">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
        <NavbarLogo />

        <NavbarLinks />

        {/* Desktop actions */}
        <div className="ml-auto hidden items-center gap-2 lg:flex">
          <ThemeToggle variant="circle" start="center" />
          <AuthButtons
            variant="desktop"
            isPending={isPending}
            session={session}
            onSignOut={handleSignOut}
          />
        </div>

        {/* Mobile actions */}
        <div className="ml-auto flex items-center gap-2 lg:hidden">
          <ThemeToggle variant="circle" start="center" />
          <Button
            type="button"
            variant="ghost"
            size="icon-lg"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            onClick={() => setMenuOpen((open) => !open)}
            className="size-11"
          >
            {menuOpen ? (
              <IconX size={21} stroke={1.8} />
            ) : (
              <IconMenu2 size={21} stroke={1.8} />
            )}
          </Button>
        </div>
      </div>

      <NavbarMobileMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        isPending={isPending}
        session={session}
        onSignOut={handleSignOut}
      />
    </header>
  );
};

export { Navbar };
