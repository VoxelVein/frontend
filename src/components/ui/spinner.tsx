import { IconLoader } from "@tabler/icons-react";
import { cn } from "cn";
import type { ComponentProps } from "react";

function Spinner({
  className,
  label = "Loading",
  ...props
}: ComponentProps<"output"> & { label?: string }) {
  return (
    <output
      data-slot="spinner"
      aria-busy="true"
      aria-label={label}
      className={cn("inline-flex size-4 animate-spin", className)}
      {...props}
    >
      <IconLoader aria-hidden="true" className="size-full" />
    </output>
  );
}

export { Spinner };
