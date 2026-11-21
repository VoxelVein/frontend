import { Link } from "@tanstack/react-router";

import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";

interface NavbarLogoProps {
  className?: string;
}

const NavbarLogo = ({ className }: NavbarLogoProps) => (
  <Link
    to="/"
    aria-label="VoxelVein home"
    className={cn(
      "group focus-visible:ring-ring flex min-h-11 shrink-0 items-center gap-2 rounded-md focus-visible:ring-2 focus-visible:outline-none",
      className
    )}
  >
    <Logo className="ease-smooth group-hover:text-primary h-8 w-8 transition-colors duration-200 motion-reduce:transition-none" />
    <span className="text-foreground text-lg font-semibold tracking-tight">
      VoxelVein
    </span>
  </Link>
);

export { NavbarLogo };
