import { useCallback } from "react";
import type { RefObject } from "react";

import { STEP_TITLES } from "@/components/settings/danger/deletion-flow";
import type { DeletionStep } from "@/components/settings/danger/deletion-flow";

interface StepHeadingProps {
  headingRef: RefObject<HTMLHeadingElement | null>;
  step: DeletionStep;
}

/**
 * Render with `key={step}`: each step mounts a fresh heading, which takes
 * focus so keyboard and screen reader users land at the start of the step.
 */
export const StepHeading = ({ headingRef, step }: StepHeadingProps) => {
  const focusOnMount = useCallback(
    (node: HTMLHeadingElement | null) => {
      headingRef.current = node;
      node?.focus();
    },
    [headingRef]
  );

  return (
    <h3
      ref={focusOnMount}
      tabIndex={-1}
      className="text-foreground text-base font-semibold outline-none"
    >
      {STEP_TITLES[step]}
    </h3>
  );
};
