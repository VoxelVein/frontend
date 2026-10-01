# Motion

The animation layer is hand-written: a scroll-reveal primitive, a small
easing library, and four bespoke components. There is no animation
dependency, and nothing animates through React state on a per-frame basis
except where noted.

## Easing

`src/lib/ease.ts` holds the curves, so scroll reveals and inline styles
share one definition instead of copying literals around.

`EASE_OUT_CSS`
: `"cubic-bezier(0.16, 1, 0.3, 1)"`, the CSS string form used for inline
  `transition` styles. Reach for this first.

`cubicBezier(x1, y1, x2, y2)`
: The same curve as a JavaScript function mapping linear progress to eased
  progress, for animations driven frame by frame rather than by CSS. It
  inverts `x(t)` with Newton's method over `NEWTON_ITERATIONS` (5) steps
  and clamps `t` to 0–1.

`springEasingCss({ damping, stiffness, mass, durationMs })`
: Emits a CSS `linear()` timing function sampled from a damped spring, so
  plain CSS transitions can match a spring preset. It derives `omega` from
  `sqrt(stiffness / mass)` and `zeta` from the damping ratio, emits
  `SPRING_SAMPLES` (24) stops, and pins the last one to `1`.

Only underdamped and critically damped springs are supported. Pick a
duration long enough for the spring to settle, because the curve is
truncated at the sample boundary rather than solved to rest.

## Scroll reveal

`Reveal` (`src/components/reveal.tsx`) fades and lifts its children the
first time they scroll into view.

It is a one-shot `IntersectionObserver` with `threshold: 0` and
`rootMargin: "0px 0px -48px 0px"`, so an element has to clear 48 px past the
bottom of the viewport before it counts as visible. The observer
disconnects as soon as it fires, so scrolling back up never re-hides
anything.

The animation is CSS, not JS. `.animate-reveal-up` in `src/styles.css`
sits at `opacity: 0` with `animation-play-state: paused`; adding
`.is-visible` switches it to `running` and the keyframes do
`translateY(20px)` to `0`.

The `delay` prop is in **seconds**, converted to an `animationDelay`, and
is how lists stagger. Cap it: the dashboard passes
`Math.min(index, 5) * 0.06` so a long list does not accumulate a delay
the user has to sit through.

### One caveat

Because the resting state is `opacity: 0` and the animation is paused
until the observer fires, **a `Reveal` block is invisible without
JavaScript**. The app is server-rendered, so this is a progressive
enhancement trade rather than a hydration bug. Keep `Reveal` for content
that also appears elsewhere, and do not wrap a page's only copy of
something in it.

## Reduced motion

Two independent layers, and both matter.

A global override in `src/styles.css` collapses every animation and
transition to `0.01ms` and forces `scroll-behavior: auto` under
`prefers-reduced-motion: reduce`. That covers anything driven by CSS.

`usePrefersReducedMotion()`
: An SSR-safe `useSyncExternalStore` over `matchMedia`, for components
  that need to skip work rather than merely shorten it. Its
  `getServerSnapshot` returns `false`, meaning the server assumes motion
  is allowed and the client corrects it after hydration.

## Components

Four live in `src/components/motion/`.

`RotatingText`
: Crossfades a list of strings in a clipped pill, using a spring preset
  (damping 30, stiffness 400) with a 25 ms per-item stagger applied from
  the last character backwards. Splits by grapheme with
  `Intl.Segmenter`, so emoji and combining marks stay intact. Used by the
  hero.

`IconSwap`
: Crossfades between two children across stacked grid cells, with a
  200 ms exit. Used by the theme toggle.

`PixelReveal`
: Drives the CSS `::view-transition-new(root)` pseudo-element from a
  `requestAnimationFrame` loop, so a view transition dissolves through a
  grid of individually-masked pixels — one mask layer per cell, which CSS
  alone cannot express. `PIXEL_SWAP_PRESET` is 64 px cells over 600 ms,
  with a 250 ms per-pixel growth and a 0.35 scale. It is the only one of
  these four that runs its own animation loop rather than delegating to a
  CSS transition. Used by the theme toggle's `pixel` variant.

`ThemeToggle`
: Wraps the other three and offers four transitions — `rectangle`,
  `circle`, `blinds`, and `pixel`, defaulting to `rectangle`. It injects
  one `<style>` element with the id `beui-theme-toggle-vt`, registers an
  `@property --beui-vt-slat` so the blinds mask can be animated, then sets
  `data-beui-vt` on the document root and lets the view transition run.
  Note that the `rectangle` variant writes the attribute value `rect`, so
  the variant name and the CSS selector do not match. Used by the navbar.

## Durations

The project guideline is to keep UI transitions under 400 ms. Only one
transition in this layer meets it:

* `rectangle` theme transition — 400 ms
* `pixel` theme transition — 600 ms
* `circle` and `blinds` theme transitions — 700 ms
* `.animate-reveal-up` — 600 ms
* `IconSwap` exit — 200 ms

All the long ones are entrance or theme-change moments, where a slower
curve reads as deliberate rather than laggy, and none of them is feedback
on a click or a keystroke. Anything that does react to direct
manipulation should stay under 400 ms.

## Adding to this

Reach for `EASE_OUT_CSS` and a CSS transition first. When a curve is
needed in JavaScript, add it to `src/lib/ease.ts` rather than solving
bezier parameters at the call site. When something is genuinely
per-frame, it must honour `usePrefersReducedMotion()`.

## Related

* [Accessibility Standards](../accessibility/standards.md) — the WCAG 2.2
  AA baseline these animations must not break
* [Discovery](discovery.md) — where `Reveal` is used
* [Custom Theme](../theming/custom-theme.md) — the tokens motion inherits
