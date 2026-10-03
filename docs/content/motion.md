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

The animation is CSS, not JS, and it is a **transition** rather than
keyframes — which is what the "reach for `EASE_OUT_CSS` first" rule below
asks for. `.reveal` in `src/styles.css` sits at `opacity: 0` and
`translateY(16px)`; adding `.is-visible` transitions both to their resting
place over 500 ms on the project curve.

The curve, distance and duration are read from custom properties
(`--reveal-delay`, `--reveal-distance`, `--reveal-duration`), so one CSS
definition serves every reveal on a page and a caller can tune a single
block through props rather than through a new class per variant.

### Content is never stranded

The resting state is hidden, and that is only safe because two rules in
`styles.css` force it visible when the observer cannot run:

* `@media (prefers-reduced-motion: reduce)` — content shown, not moved,
  transition removed.
* `@media (scripting: none)` — content shown with no JavaScript.

An earlier version used a paused keyframe animation, which left every
`Reveal` block **invisible without JavaScript** and invisible under reduced
motion until the observer happened to fire. The global duration override
that collapses transitions to `0.01ms` does not help on its own: it
shortens the animation without moving the element off `opacity: 0`.

### Staggering

`delay` is in **seconds**. Use `staggerDelay(index)` from
`src/lib/reveal-stagger.ts` rather than writing the arithmetic at a call
site: it caps at four items, so an unbounded list cannot accumulate a
delay nobody waits for. Every staggered grid on the landing page uses it,
which is what makes the trending row, the category tiles and the news
ledger feel like one page rather than three.

## The landing page

Four sections, one motion system:

* `Hero` — keyframes, deliberately, because it is above the fold and has to
  reach its resting state from the stylesheet alone with no JavaScript. The
  headline lands, then the call to action 90 ms behind it, so the eye reads
  the sentence before the button. Same curve as everything below it.
* `TrendingProjects` — the heading reveals on its own, then the cards land in
  sequence. One block for the whole section made five cards arrive as a slab.
* `NewsSection` — the lead story leads, and the ledger entries stagger behind
  it.
* `ExploreSection` — heading, then the category tiles.

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

## Overlays

Dialogs, alert dialogs, dropdowns, selects, comboboxes and the cookie banner
are not hand-written: they animate through `tw-animate-css`, imported at the
top of `src/styles.css`. That library takes its curve from `--tw-ease` and its
duration from `--tw-duration`.

It ships a default curve of `cubic-bezier(.32,.72,0,1)`, which is not the
project curve, so `--tw-ease` is set on `:root` to `--motion-ease`. Declaring
it after the import is what makes it win.

Two traps in that library, both of which have been live here:

* **`animate-none` compiles to `animation: none !important`.** The dropdown and
  select popups carried it *alongside* `data-open:animate-in`, on the same
  element. The important flag won, so both menus had an animation written on
  them that could never run and appeared instantly. A behavioural test cannot
  catch this — the menu still opens, closes and traps focus — which is why
  `overlay-motion.test.tsx` asserts on the class list.
* **`ease-*` utilities write `--tw-ease`, not `transition-timing-function`.**
  That is a tw-animate override of Tailwind's own utilities, so on a keyframe
  animation `ease-smooth` does take effect — just not through the property its
  name suggests.

Menu items highlight on `data-highlighted` (Base UI) and transition at
150 ms. Without that they snapped, which is the most-noticed interaction in a
dropdown: the highlight jumping between items as the pointer moves.

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
* `.reveal` — 500 ms
* `IconSwap` exit — 200 ms

Hover and press feedback stays at 200 ms: the explore tiles, the project
cards, the news ledger rows and the hero button all use the same figure, so
pointing at the page moves at one speed regardless of which element is under
the pointer.

The longer ones are entrance or theme-change moments, where a slower curve
reads as deliberate rather than laggy, and none of them is feedback on a click
or a keystroke. Anything that does react to direct manipulation should stay
under 400 ms.

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
