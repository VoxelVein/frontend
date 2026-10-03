import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/utils";

/** How far below its resting place a block starts, in pixels. */
const REVEAL_DISTANCE = 16;

/**
 * Scroll-reveal: fades and lifts its children the first time they come into view.
 *
 * Built on a CSS **transition** rather than keyframes, which is what
 * `docs/content/motion.md` asks for and what `EASE_OUT_CSS` exists for. The
 * curve, the distance and the duration are passed in as custom properties so a
 * caller can tune one without a new class, and so every reveal on a page shares
 * one definition.
 *
 * The hidden resting state is a problem this shape solves rather than accepts:
 * a paused keyframe animation leaves content invisible when the observer never
 * fires, so the fallback states in `styles.css` force the block visible when
 * scripting is off or reduced motion is asked for. Content is never stranded.
 */
/**
 * Custom properties are not in React's `CSSProperties`, and widening the type
 * here beats an assertion at the call site: the shape is exactly the two
 * variables `.reveal` reads, so a typo becomes a type error.
 */
interface RevealStyle extends CSSProperties {
  "--reveal-delay"?: string;
  "--reveal-distance"?: string;
}

interface RevealProps {
  children: ReactNode;
  className?: string;
  /** Delay in seconds before the reveal starts. Cap this on long lists. */
  delay?: number;
  /** Start offset in pixels. Smaller is calmer; 0 fades in place. */
  distance?: number;
}

const Reveal = ({
  children,
  className,
  delay = 0,
  distance = REVEAL_DISTANCE,
}: RevealProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      // 48px past the bottom edge, so a block has to genuinely be arriving
      // rather than being caught by a viewport that was already scrolled down.
      { rootMargin: "0px 0px -48px 0px", threshold: 0 }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const style: RevealStyle = {
    "--reveal-delay": `${delay * 1000}ms`,
    "--reveal-distance": `${distance}px`,
  };

  return (
    <div
      className={cn("reveal", isVisible && "is-visible", className)}
      data-visible={isVisible}
      ref={ref}
      style={style}
    >
      {children}
    </div>
  );
};

export { Reveal };
