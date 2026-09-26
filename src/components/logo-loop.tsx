import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, Key, ReactNode, RefObject } from "react";

import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { cn } from "@/lib/utils";

/** Axis the track travels along. */
type LoopDirection = "down" | "left" | "right" | "up";

/** A logo rendered from an inline node, typically an SVG icon component. */
interface LogoNodeItem {
  /** Overrides the accessible name of a linked item. */
  ariaLabel?: string;
  /** Where the item links to. Omit to render it unlinked. */
  href?: string;
  /** The graphic to render. Sized from the loop's `logoHeight`. */
  node: ReactNode;
  /** Tooltip text, and the accessible name of a linked item. */
  title?: string;
}

/** A logo rendered from an image source. */
interface LogoImageItem {
  /** Alternative text. Empty by default, since a linked item is named by its link. */
  alt?: string;
  height?: number;
  /** Where the item links to. Omit to render it unlinked. */
  href?: string;
  sizes?: string;
  src: string;
  srcSet?: string;
  /** Tooltip text, and the accessible name of a linked item. */
  title?: string;
  width?: number;
}

type LogoItem = LogoImageItem | LogoNodeItem;

interface LogoLoopProps {
  /** Accessible name for the region wrapping the loop. */
  ariaLabel?: string;
  className?: string;
  direction?: LoopDirection;
  /** Softens the edges where the track is clipped. */
  fadeOut?: boolean;
  /** Colour the edge fades resolve to. Should match the surface behind the loop. */
  fadeOutColor?: string;
  /** Space between logos, in pixels. */
  gap?: number;
  /** Speed while the pointer is over the track, in pixels per second. `0` stops it. */
  hoverSpeed?: number;
  /** Logo height in pixels. Also drives node sizing, which is sized in `em`. */
  logoHeight?: number;
  /** The logos to loop. Keep this reference stable to avoid re-measuring on every render. */
  logos: LogoItem[];
  /** Legacy switch for `hoverSpeed`. `false` opts out of hover handling entirely. */
  pauseOnHover?: boolean;
  /** Replaces the default item markup. */
  renderItem?: (item: LogoItem, key: Key) => ReactNode;
  /** Enlarges a logo while the pointer is over it. */
  scaleOnHover?: boolean;
  /** Travel speed in pixels per second. A negative value reverses `direction`. */
  speed?: number;
  style?: CSSProperties;
  /** Container width. A number is read as pixels, a string as a CSS length. */
  width?: number | string;
}

/** Smoothing time constant, in seconds, for easing into the hover speed. */
const SMOOTH_TAU = 0.25;
/** Two copies is the minimum that makes the wrap seamless. */
const MIN_COPIES = 2;
/** Copies rendered beyond the visible width, to absorb rounding. */
const COPY_HEADROOM = 2;

const EDGE_FADE_EXTENT = "clamp(24px, 8%, 120px)";

const isVerticalDirection = (direction: LoopDirection) =>
  direction === "down" || direction === "up";

/** Signed velocity in pixels per second. Positive travels towards the origin. */
const velocityFor = (speed: number, direction: LoopDirection) => {
  const magnitude = Math.abs(speed);
  const sign = speed < 0 ? -1 : 1;
  return direction === "left" || direction === "up"
    ? magnitude * sign
    : -magnitude * sign;
};

/** Keeps the offset inside `[0, size)` so the wrap stays seamless in both directions. */
const normalizeOffset = (offset: number, size: number) =>
  ((offset % size) + size) % size;

const offsetTransform = (offset: number, isVertical: boolean) =>
  isVertical
    ? `translate3d(0, ${-offset}px, 0)`
    : `translate3d(${-offset}px, 0, 0)`;

/**
 * Reads a numeric width as a pixel measurement and passes anything carrying its
 * own unit through unchanged, so `"300"` and `300` both mean `300px`.
 */
const toCssLength = (value: number | string) => {
  const asNumber = Number(value);
  return Number.isFinite(asNumber) ? `${asNumber}px` : String(value);
};

const accessibleNameFor = (item: LogoItem) =>
  "node" in item ? (item.ariaLabel ?? item.title) : (item.alt ?? item.title);

const itemClassName = (isVertical: boolean) =>
  cn(
    "shrink-0 text-[length:var(--logo-height)] leading-none",
    isVertical ? "mb-[var(--logo-gap)]" : "mr-[var(--logo-gap)]"
  );

const visualClassName = (scaleOnHover: boolean) =>
  cn(
    "inline-flex items-center transition-transform duration-300 ease-out motion-reduce:transform-none motion-reduce:transition-none",
    scaleOnHover && "group-hover/item:scale-120"
  );

/** Width the container should take. A vertical loop fills its parent instead. */
const toContainerWidth = (
  width: number | string,
  isVertical: boolean
): CSSProperties => {
  const length = toCssLength(width);
  if (isVertical && length === "100%") {
    return {};
  }
  return { width: length };
};

/**
 * How a horizontal loop clips. Reduced motion swaps the clip for a scrollbar,
 * because the duplicated copies a scrolling loop needs are `inert`, and a
 * frozen loop would otherwise leave most logos unreachable.
 */
const overflowClassName = (isVertical: boolean, isReducedMotion: boolean) => {
  if (isVertical) {
    return "inline-block h-full overflow-hidden";
  }
  return isReducedMotion ? "overflow-x-auto" : "overflow-x-hidden";
};

/**
 * Calls `measure` whenever `target` changes size, falling back to window
 * resizes on engines without `ResizeObserver`.
 *
 * The observer is attached once per target and always calls the most recent
 * `measure`, so a changing callback never re-registers the listener.
 */
const useResizeObserver = (
  measure: () => void,
  target: RefObject<Element | null>
) => {
  const measureRef = useRef(measure);

  useEffect(() => {
    measureRef.current = measure;
  });

  useEffect(() => {
    const element = target.current;
    if (!element) {
      return;
    }

    // oxlint-disable-next-line promise/prefer-await-to-callbacks -- resize is a DOM event dispatched by the browser, not a promise executor
    const handleResize = () => measureRef.current();

    if (!window.ResizeObserver) {
      window.addEventListener("resize", handleResize);
      measureRef.current();
      return () => window.removeEventListener("resize", handleResize);
    }

    const observer = new ResizeObserver(handleResize);
    observer.observe(element);
    measureRef.current();
    return () => observer.disconnect();
  }, [target]);
};

/**
 * Calls `onSettled` once every image inside `scope` has loaded or failed, so
 * the sequence can be re-measured. Images have no intrinsic size until then, so
 * without this the first measurement would size the copies against an empty
 * sequence.
 *
 * This only covers the initial paint, where the race actually loses. Later
 * images arrive through a `logos` change, and loading one resizes the sequence,
 * which the observer on the sequence already reports.
 */
const useImageLoad = (
  scope: RefObject<Element | null>,
  onSettled: () => void
) => {
  useEffect(() => {
    const root = scope.current;
    const pending = new Set(
      [...(root?.querySelectorAll("img") ?? [])].filter(
        (image) => !image.complete
      )
    );

    if (pending.size === 0) {
      onSettled();
      return;
    }

    // `load` and `error` do not bubble, but they do capture, so one delegated
    // pair on the sequence covers every image instead of two listeners each.
    // oxlint-disable-next-line promise/prefer-await-to-callbacks -- load/error are DOM events dispatched by the browser, not promise executors
    const handleSettled = (event: Event) => {
      const { target } = event;
      if (!(target instanceof HTMLImageElement) || !pending.delete(target)) {
        return;
      }
      if (pending.size === 0) {
        onSettled();
      }
    };

    root?.addEventListener("load", handleSettled, true);
    root?.addEventListener("error", handleSettled, true);

    return () => {
      root?.removeEventListener("load", handleSettled, true);
      root?.removeEventListener("error", handleSettled, true);
    };
  }, [scope, onSettled]);
};

interface AnimationLoopOptions {
  hoverSpeed: number | undefined;
  isHovered: boolean;
  isReducedMotion: boolean;
  isVertical: boolean;
  seqHeight: number;
  seqWidth: number;
  targetVelocity: number;
  trackRef: RefObject<HTMLDivElement | null>;
}

/**
 * Advances the track with a request animation frame loop, easing towards the
 * target velocity so hover speed changes decelerate instead of snapping.
 *
 * The loop does not run until the sequence has been measured, and not at all
 * when the user prefers reduced motion.
 */
const useAnimationLoop = ({
  hoverSpeed,
  isHovered,
  isReducedMotion,
  isVertical,
  seqHeight,
  seqWidth,
  targetVelocity,
  trackRef,
}: AnimationLoopOptions) => {
  const frameRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number | null>(null);
  const offsetRef = useRef(0);
  const velocityRef = useRef(0);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) {
      return;
    }

    const sequenceSize = isVertical ? seqHeight : seqWidth;
    if (sequenceSize > 0) {
      offsetRef.current = normalizeOffset(offsetRef.current, sequenceSize);
      track.style.transform = offsetTransform(offsetRef.current, isVertical);
    }

    if (isReducedMotion || sequenceSize <= 0) {
      return () => {
        lastFrameRef.current = null;
      };
    }

    const animate = (timestamp: number) => {
      const previous = lastFrameRef.current ?? timestamp;
      const deltaSeconds = Math.max(0, timestamp - previous) / 1000;
      lastFrameRef.current = timestamp;

      const target =
        isHovered && hoverSpeed !== undefined ? hoverSpeed : targetVelocity;
      const easing = 1 - Math.exp(-deltaSeconds / SMOOTH_TAU);
      velocityRef.current += (target - velocityRef.current) * easing;

      const next = normalizeOffset(
        offsetRef.current + velocityRef.current * deltaSeconds,
        sequenceSize
      );
      offsetRef.current = next;
      track.style.transform = offsetTransform(next, isVertical);

      frameRef.current = requestAnimationFrame(animate);
    };

    frameRef.current = requestAnimationFrame(animate);

    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      lastFrameRef.current = null;
    };
  }, [
    trackRef,
    targetVelocity,
    seqWidth,
    seqHeight,
    isHovered,
    hoverSpeed,
    isVertical,
    isReducedMotion,
  ]);
};

const EdgeFades = ({ isVertical }: { isVertical: boolean }) => (
  <>
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute z-10",
        isVertical
          ? "inset-x-0 top-0 h-(--logo-fade-extent) bg-[linear-gradient(to_bottom,var(--logo-fade)_0%,transparent_100%)]"
          : "inset-y-0 left-0 w-(--logo-fade-extent) bg-[linear-gradient(to_right,var(--logo-fade)_0%,transparent_100%)]"
      )}
    />
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute z-10",
        isVertical
          ? "inset-x-0 bottom-0 h-(--logo-fade-extent) bg-[linear-gradient(to_top,var(--logo-fade)_0%,transparent_100%)]"
          : "inset-y-0 right-0 w-(--logo-fade-extent) bg-[linear-gradient(to_left,var(--logo-fade)_0%,transparent_100%)]"
      )}
    />
  </>
);

interface RenderItemOptions {
  isVertical: boolean;
  renderItem: LogoLoopProps["renderItem"];
  scaleOnHover: boolean;
}

const renderLogoItem = (
  item: LogoItem,
  key: Key,
  { isVertical, renderItem, scaleOnHover }: RenderItemOptions
) => {
  const className = itemClassName(isVertical);

  if (renderItem) {
    return (
      <li className={className} key={key}>
        {renderItem(item, key)}
      </li>
    );
  }

  const isNodeItem = "node" in item;
  const isLinked = item.href !== undefined;
  const accessibleName = accessibleNameFor(item);

  const visual = isNodeItem ? (
    <span
      // A linked graphic is already named by its link, so hiding it only avoids
      // a duplicate announcement. An unlinked one has to stay exposed, or its
      // title is the sole carrier of the name and the logo is simply lost.
      aria-hidden={isLinked || undefined}
      className={visualClassName(scaleOnHover)}
      title={isLinked ? undefined : item.title}
    >
      {item.node}
    </span>
  ) : (
    <img
      alt={item.alt ?? ""}
      className={cn(
        "pointer-events-none block h-[var(--logo-height)] w-auto object-contain [-webkit-user-drag:none] [image-rendering:-webkit-optimize-contrast]",
        visualClassName(scaleOnHover)
      )}
      decoding="async"
      draggable={false}
      height={item.height}
      loading="lazy"
      sizes={item.sizes}
      src={item.src}
      srcSet={item.srcSet}
      title={item.title}
      width={item.width}
    />
  );

  if (!isLinked) {
    return (
      <li className={className} key={key}>
        {visual}
      </li>
    );
  }

  return (
    <li className={className} key={key}>
      <a
        aria-label={accessibleName}
        className="focus-visible:ring-ring inline-flex min-h-11 items-center justify-center rounded-md px-2 focus-visible:ring-2 focus-visible:outline-none"
        href={item.href}
        rel="noopener noreferrer"
        target="_blank"
        title={item.title}
      >
        {visual}
      </a>
    </li>
  );
};

/**
 * A marquee of logos that scrolls continuously and wraps seamlessly.
 *
 * The track is measured, then duplicated just enough times to cover the
 * container, so the loop never reveals a gap. Duplicates are marked `inert`
 * rather than only `aria-hidden`, which keeps them out of the tab order as well
 * as out of the accessibility tree.
 *
 * When the user prefers reduced motion the animation frame loop is never
 * started, a single copy is rendered, and the container scrolls instead. That
 * keeps every logo reachable by keyboard, which a frozen loop of `inert`
 * duplicates would not.
 */
const LogoLoop = ({
  ariaLabel = "Partner logos",
  className,
  direction = "left",
  fadeOut = false,
  fadeOutColor,
  gap = 32,
  hoverSpeed,
  logoHeight = 28,
  logos,
  pauseOnHover,
  renderItem,
  scaleOnHover = false,
  speed = 120,
  style,
  width = "100%",
}: LogoLoopProps) => {
  const isReducedMotion = usePrefersReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const seqRef = useRef<HTMLUListElement>(null);

  const [seqWidth, setSeqWidth] = useState(0);
  const [seqHeight, setSeqHeight] = useState(0);
  const [copyCount, setCopyCount] = useState(MIN_COPIES);
  const [isHovered, setIsHovered] = useState(false);

  const isVertical = isVerticalDirection(direction);
  const targetVelocity = useMemo(
    () => velocityFor(speed, direction),
    [speed, direction]
  );
  const effectiveHoverSpeed = useMemo(() => {
    if (hoverSpeed !== undefined) {
      return hoverSpeed;
    }
    return pauseOnHover === false ? undefined : 0;
  }, [hoverSpeed, pauseOnHover]);

  const updateDimensions = useCallback(() => {
    const container = containerRef.current;
    const sequence = seqRef.current;
    if (!(container && sequence)) {
      return;
    }

    if (isVertical) {
      const parentHeight = container.parentElement?.clientHeight ?? 0;
      if (parentHeight > 0) {
        const target = `${Math.ceil(parentHeight)}px`;
        if (container.style.height !== target) {
          container.style.height = target;
        }
      }

      const sequenceHeight = sequence.getBoundingClientRect().height;
      if (sequenceHeight <= 0) {
        return;
      }
      setSeqHeight(Math.ceil(sequenceHeight));
      const viewport = container.clientHeight || parentHeight || sequenceHeight;
      setCopyCount(
        Math.max(
          MIN_COPIES,
          Math.ceil(viewport / sequenceHeight) + COPY_HEADROOM
        )
      );
      return;
    }

    const sequenceWidth = sequence.getBoundingClientRect().width;
    if (sequenceWidth <= 0) {
      return;
    }
    setSeqWidth(Math.ceil(sequenceWidth));
    setCopyCount(
      Math.max(
        MIN_COPIES,
        Math.ceil(container.clientWidth / sequenceWidth) + COPY_HEADROOM
      )
    );
  }, [isVertical]);

  useResizeObserver(updateDimensions, containerRef);
  useResizeObserver(updateDimensions, seqRef);
  useImageLoad(seqRef, updateDimensions);
  useAnimationLoop({
    hoverSpeed: effectiveHoverSpeed,
    isHovered,
    isReducedMotion,
    isVertical,
    seqHeight,
    seqWidth,
    targetVelocity,
    trackRef,
  });

  const containerStyle: CSSProperties = {
    ...toContainerWidth(width, isVertical),
    // SAFETY: CSS custom properties are not modelled on CSSProperties, so the
    // variable map has to be asserted before it can be spread into style.
    ...({
      "--logo-fade": fadeOutColor ?? "transparent",
      "--logo-fade-extent": EDGE_FADE_EXTENT,
      "--logo-gap": `${gap}px`,
      "--logo-height": `${logoHeight}px`,
    } as CSSProperties),
    ...style,
  };

  const copies = isReducedMotion ? 1 : copyCount;

  return (
    <section
      aria-label={ariaLabel}
      className={cn(
        "relative",
        overflowClassName(isVertical, isReducedMotion),
        scaleOnHover && "py-[calc(var(--logo-height)*0.1)]",
        className
      )}
      ref={containerRef}
      style={containerStyle}
    >
      {fadeOut && <EdgeFades isVertical={isVertical} />}

      <div
        className={cn(
          "relative z-0 flex w-max will-change-transform select-none motion-reduce:transform-none",
          isVertical && "h-max w-full flex-col"
        )}
        onMouseEnter={() => {
          if (effectiveHoverSpeed !== undefined) {
            setIsHovered(true);
          }
        }}
        onMouseLeave={() => {
          if (effectiveHoverSpeed !== undefined) {
            setIsHovered(false);
          }
        }}
        ref={trackRef}
      >
        {Array.from({ length: copies }, (_, copyIndex) => {
          const isDuplicate = copyIndex > 0;
          return (
            <ul
              className={cn("flex items-center", isVertical && "flex-col")}
              inert={isDuplicate}
              key={`copy-${copyIndex}`}
              ref={isDuplicate ? undefined : seqRef}
            >
              {logos.map((item, itemIndex) =>
                renderLogoItem(item, `${copyIndex}-${itemIndex}`, {
                  isVertical,
                  renderItem,
                  scaleOnHover,
                })
              )}
            </ul>
          );
        })}
      </div>
    </section>
  );
};

export { LogoLoop };
export type { LogoItem, LogoLoopProps };
