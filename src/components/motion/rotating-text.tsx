// Port of React Bits' RotatingText (reactbits.dev/text-animations/rotating-text)
// without the motion runtime: characters slide with CSS transitions and
// @starting-style, and the pill resizes by animating clip-path instead of
// motion's layout animation.

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

import { springEasingCss } from "@/lib/ease";
import { cn } from "@/lib/utils";

// React Bits demo preset: spring (damping 30, stiffness 400), 25ms stagger
// from the last character, 2s per text.
const TRANSITION_MS = 400;
const SPRING_EASING = springEasingCss({
  damping: 30,
  durationMs: TRANSITION_MS,
  stiffness: 400,
});
const DEFAULT_ROTATION_INTERVAL_MS = 2000;
// By this point in the transition the exiting spring has cleared the clip.
const EXIT_VISIBLE_MS = TRANSITION_MS / 2;
const DEFAULT_STAGGER_MS = 25;

interface Glyph {
  char: string;
  id: string;
  order: number;
}

interface Word {
  glyphs: Glyph[];
  id: string;
  trailingSpace: boolean;
}

const segmenter =
  typeof Intl !== "undefined" && "Segmenter" in Intl
    ? new Intl.Segmenter("en", { granularity: "grapheme" })
    : null;

const splitGraphemes = (word: string): string[] =>
  segmenter
    ? Array.from(segmenter.segment(word), ({ segment }) => segment)
    : [...word];

interface SplitText {
  total: number;
  words: Word[];
}

/** Splits text into words of individually animated characters. */
const splitText = (text: string): SplitText => {
  const parts = text.split(" ");
  const words: Word[] = [];
  let order = 0;

  for (const [wordIndex, part] of parts.entries()) {
    const glyphs: Glyph[] = [];
    for (const [charIndex, char] of splitGraphemes(part).entries()) {
      glyphs.push({ char, id: `${wordIndex}-${charIndex}`, order });
      order += 1;
    }
    words.push({
      glyphs,
      id: String(wordIndex),
      trailingSpace: wordIndex < parts.length - 1,
    });
  }

  return { total: order, words };
};

interface RotatingTextProps {
  texts: readonly string[];
  className?: string;
  /** Classes for the per-word clipping wrapper that hides sliding characters. */
  splitLevelClassName?: string;
  /** Classes for each measured text box; use for the pill's horizontal padding. */
  textClassName?: string;
  /** Stops the rotation on the current text. */
  paused?: boolean;
  rotationInterval?: number;
  staggerDuration?: number;
  staggerFrom?: "first" | "last";
}

const RotatingText = ({
  texts,
  className,
  splitLevelClassName,
  textClassName,
  paused = false,
  rotationInterval = DEFAULT_ROTATION_INTERVAL_MS,
  staggerDuration = DEFAULT_STAGGER_MS,
  staggerFrom = "last",
}: RotatingTextProps) => {
  const [index, setIndex] = useState(0);
  const [isExiting, setIsExiting] = useState(false);
  const [widths, setWidths] = useState<number[]>([]);
  const containerRef = useRef<HTMLSpanElement>(null);
  const sizerRefs = useRef<(HTMLSpanElement | null)[]>([]);

  const { total, words } = splitText(texts[index] ?? "");
  // The spring passes the clipping edge well before it settles, so swap once
  // the last character is out of view instead of waiting for it to come to
  // rest; otherwise the pill sits empty between texts.
  const exitDurationMs = EXIT_VISIBLE_MS + (total - 1) * staggerDuration;

  const delayFor = (order: number) =>
    (staggerFrom === "last" ? total - 1 - order : order) * staggerDuration;

  // Every text is laid out invisibly in the same grid cell, so the container
  // is as wide as the longest text and never shifts the layout. Their widths
  // drive the pill's clip-path; re-measure when fonts load or the viewport
  // changes the font size. A different set of texts resizes the container
  // too, so the observer covers that as well.
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const measure = () => {
      setWidths(sizerRefs.current.map((sizer) => sizer?.offsetWidth ?? 0));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Each swap clears isExiting, which re-arms the timer for the next text.
  useEffect(() => {
    if (paused || isExiting || texts.length < 2) {
      return;
    }
    const exitTimer = setTimeout(() => setIsExiting(true), rotationInterval);
    return () => clearTimeout(exitTimer);
  }, [isExiting, paused, rotationInterval, texts.length]);

  useEffect(() => {
    if (!isExiting) {
      return;
    }
    const swapTimer = setTimeout(() => {
      setIndex((current) => (current + 1) % texts.length);
      setIsExiting(false);
    }, exitDurationMs);
    return () => clearTimeout(swapTimer);
  }, [exitDurationMs, isExiting, texts.length]);

  // Until the texts are measured (server render, first paint) the pill spans
  // the widest text, so the light-on-primary text stays readable. Going from
  // no clip-path to an inset is not interpolated, so it does not animate.
  const width = widths[index];
  const pillStyle: CSSProperties = {
    clipPath:
      width === undefined
        ? undefined
        : `inset(0 calc((100% - ${width}px) / 2) round var(--radius-lg))`,
    transitionDuration: `${TRANSITION_MS}ms`,
    transitionTimingFunction: SPRING_EASING,
  };

  return (
    <span
      ref={containerRef}
      className={cn("relative inline-grid justify-items-center", className)}
    >
      <span
        aria-hidden="true"
        className="bg-primary absolute inset-0 rounded-lg transition-[clip-path] motion-reduce:transition-none"
        style={pillStyle}
      />

      {texts.map((text, textIndex) => (
        <span
          key={text}
          ref={(element) => {
            sizerRefs.current[textIndex] = element;
          }}
          aria-hidden="true"
          className={cn(
            "invisible col-start-1 row-start-1 whitespace-pre",
            textClassName
          )}
        >
          {text}
        </span>
      ))}

      <span
        key={index}
        aria-hidden="true"
        className={cn(
          "text-primary-foreground relative col-start-1 row-start-1 flex flex-wrap justify-center whitespace-pre",
          textClassName
        )}
      >
        {words.map((word) => (
          <span
            key={word.id}
            className={cn("inline-flex overflow-hidden", splitLevelClassName)}
          >
            {word.glyphs.map((glyph) => (
              <span
                key={glyph.id}
                className={cn(
                  "inline-block transition-transform motion-reduce:transition-none",
                  "starting:translate-y-full motion-reduce:starting:translate-y-0",
                  isExiting && "-translate-y-[120%]"
                )}
                style={{
                  transitionDelay: `${delayFor(glyph.order)}ms`,
                  transitionDuration: `${TRANSITION_MS}ms`,
                  transitionTimingFunction: SPRING_EASING,
                }}
              >
                {glyph.char}
              </span>
            ))}
            {word.trailingSpace ? (
              <span className="whitespace-pre"> </span>
            ) : null}
          </span>
        ))}
      </span>
    </span>
  );
};

export { RotatingText };
