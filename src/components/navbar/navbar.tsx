import { IconMenu2, IconX } from "@tabler/icons-react";
import { useState } from "react";

import { ThemeToggle } from "@/components/motion/theme-toggle";
import { AuthButtons } from "@/components/navbar/auth-buttons";
import { NavbarLinks } from "@/components/navbar/navbar-links";
import { NavbarLogo } from "@/components/navbar/navbar-logo";
import { NavbarMobileMenu } from "@/components/navbar/navbar-mobile";
import { Button } from "@/components/ui/button";
import { useSignOut } from "@/hooks/use-sign-out";
import { authClient } from "@/lib/auth-client";

const Navbar = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const { data: session, isPending } = authClient.useSession();
  const signOut = useSignOut();

  const handleSignOut = () => {
    setMenuOpen(false);
    void signOut();
  };

  return (
    <header className="border-border/60 bg-background/80 supports-[backdrop-filter]:bg-background/65 sticky top-0 z-50 border-b backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
        <NavbarLogo />

        <NavbarLinks />

        {/* Desktop actions */}
        <div className="ml-auto hidden items-center gap-2 lg:flex">
          <ThemeToggle variant="pixel" />
          <span aria-hidden="true" className="bg-border/70 mx-0.5 h-6 w-px" />
          <AuthButtons
            variant="desktop"
            isPending={isPending}
            session={session}
            onSignOut={handleSignOut}
          />
        </div>

        {/* Mobile actions */}
        <div className="ml-auto flex items-center gap-1.5 lg:hidden">
          <ThemeToggle variant="pixel" />
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
