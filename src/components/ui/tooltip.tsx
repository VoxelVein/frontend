import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
import { cn } from "cn";
import type { ComponentProps } from "react";

/**
 * Tooltip.
 *
 * Hand-rolled out of the Base UI primitive for the same reason `breadcrumb.tsx`
 * is: the primitives here wrap one library and add the project's own focus
 * ring and surface tokens, rather than re-declaring a shadcn layer.
 *
 * **A tooltip is never the only way to know something.** It is unreachable by
 * keyboard on most implementations and disappears on touch, so anything a
 * tooltip says must also be reachable elsewhere — as helper text, a label, or a
 * disabled control that explains itself. Used here to say why an upload control
 * is unavailable, never to carry information that exists nowhere else.
 *
 * `TooltipProvider` sits at the root so a single open-at-a-time policy applies
 * across the app and the delay is set in one place rather than per call site.
 */
const TooltipProvider = ({
  delay = 200,
  ...props
}: ComponentProps<typeof TooltipPrimitive.Provider>) => (
  <TooltipPrimitive.Provider delay={delay} {...props} />
);

const Tooltip = ({
  ...props
}: ComponentProps<typeof TooltipPrimitive.Root>) => (
  <TooltipPrimitive.Root {...props} />
);

const TooltipTrigger = ({
  ...props
}: ComponentProps<typeof TooltipPrimitive.Trigger>) => (
  <TooltipPrimitive.Trigger {...props} />
);

/**
 * The floating label.
 *
 * `role="tooltip"` comes from the primitive, so the trigger's `aria-describedby`
 * points at something a screen reader will actually read.
 */
const TooltipContent = ({
  className,
  ...props
}: ComponentProps<typeof TooltipPrimitive.Popup>) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Positioner sideOffset={6}>
      <TooltipPrimitive.Popup
        className={cn(
          "bg-foreground text-background z-50 max-w-64 rounded-lg px-2.5 py-1.5 text-xs leading-relaxed",
          className
        )}
        {...props}
      />
    </TooltipPrimitive.Positioner>
  </TooltipPrimitive.Portal>
);

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger };
