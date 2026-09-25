import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
}

const Logo = ({ className }: LogoProps) => (
  <>
    <img
      src="/logo_light.png"
      alt="VoxelVein"
      width={800}
      height={800}
      className={cn(className, "dark:hidden")}
    />
    <img
      src="/logo_dark.png"
      alt="VoxelVein"
      width={800}
      height={800}
      className={cn("hidden", className, "dark:block")}
    />
  </>
);

export { Logo };
