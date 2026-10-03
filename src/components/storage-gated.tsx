import type { ReactNode } from "react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useStorageAvailable } from "@/hooks/use-storage-available";
import { STORAGE_UNAVAILABLE_REASON } from "@/lib/storage-availability";

interface StorageGatedProps {
  /** The control to gate. */
  children: (state: { isAvailable: boolean }) => ReactNode;
  /** Shown on hover. Expected to be repeated as visible helper text. */
  reason?: string;
}

/**
 * Greys out a control that needs object storage, and says why on hover.
 *
 * Wraps rather than styles, so the unavailable state is decided in one place:
 * the upload surfaces had no reason to each re-derive "is storage configured,
 * and is that check still loading", and they would have disagreed.
 *
 * **The control is genuinely disabled, not just dimmed.** A dimmed button that
 * still submits is worse than an honest one — the reader finds out it is broken
 * by trying.
 *
 * The trigger is a wrapper `<span>` rather than the control, because a disabled
 * button swallows the pointer events a tooltip needs. The span is deliberately
 * not focusable: a non-interactive element in the tab order is worse than one
 * that is skipped, and the reason reaches a keyboard user as visible helper text
 * beside the control, which is where it has to be anyway — a tooltip alone
 * would leave the explanation unreachable without a mouse.
 */
const StorageGated = ({ children, reason }: StorageGatedProps) => {
  const { isAvailable } = useStorageAvailable();

  if (isAvailable) {
    return <>{children({ isAvailable })}</>;
  }

  return (
    <Tooltip>
      <TooltipTrigger render={<span className="inline-flex" />}>
        <span
          aria-disabled="true"
          className="pointer-events-none inline-flex opacity-50"
        >
          {children({ isAvailable })}
        </span>
      </TooltipTrigger>
      <TooltipContent>{reason ?? STORAGE_UNAVAILABLE_REASON}</TooltipContent>
    </Tooltip>
  );
};

export { StorageGated };
