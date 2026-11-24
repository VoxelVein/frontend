import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

const EXIT_DURATION_MS = 200;

interface IconSwapProps {
  value: string;
  children: ReactNode;
  className?: string;
}

interface DisplayedIcon {
  children: ReactNode;
  value: string;
}

const IconSwap = ({ value, children, className }: IconSwapProps) => {
  const [displayed, setDisplayed] = useState<DisplayedIcon>({
    children,
    value,
  });

  const [isExiting, setIsExiting] = useState(false);

  // Adjust state during render: when the incoming value changes, mark the
  // current icon as exiting so it can crossfade with the incoming one.
  if (value !== displayed.value && !isExiting) {
    setIsExiting(true);
  }

  useEffect(() => {
    let id: ReturnType<typeof setTimeout> | null = null;

    if (isExiting) {
      id = setTimeout(() => {
        setDisplayed({ children, value });
        setIsExiting(false);
      }, EXIT_DURATION_MS);
    }

<<<<<<< Updated upstream
    return () => {
      if (id !== null) {
        clearTimeout(id);
      }
    };
=======
    const id = setTimeout(() => {
      setDisplayed({ children, value });
      setIsExiting(false);
    }, EXIT_DURATION_MS);

    return () => clearTimeout(id);
>>>>>>> Stashed changes
  }, [isExiting, value, children]);

  return (
    <span
      className={cn(
        "relative inline-grid shrink-0 place-items-center overflow-hidden",
        className
      )}
    >
      {isExiting ? (
        <span
          aria-hidden
          className="animate-icon-exit col-start-1 row-start-1 inline-flex items-center justify-center"
        >
          {displayed.children}
        </span>
      ) : null}
      <span
        key={value}
        aria-hidden
        className="animate-icon-enter col-start-1 row-start-1 inline-flex items-center justify-center"
      >
        {children}
      </span>
    </span>
  );
};

export { IconSwap };
