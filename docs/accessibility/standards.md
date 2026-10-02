# Accessibility Standards

Every component and page must meet **WCAG 2.2 AA**. Accessibility is a
baseline requirement, not a feature. If a change breaks accessibility,
it is a regression.

## Semantic HTML

* Use semantic elements: `<header>`, `<nav>`, `<main>`, `<section>`,
  `<article>`, `<aside>`, `<footer>`, `<button>`, `<a>`, `<form>`,
  `<label>`, `<table>`.
* Use exactly one `<main>` per page.
* Use `<section aria-labelledby="...">` to associate sections with
  their headings.
* Keep the heading hierarchy `<h1>` → `<h2>` → `<h3>` without skipping
  levels.

## Keyboard navigation

* All interactive elements must be reachable and operable with the
  keyboard (Tab, Enter, Space, Arrow keys).
* Never trap focus. If a dialog traps focus, provide a clear escape
  (Esc to close, focus returns to the trigger).
* Keep visible focus indicators — never remove `outline` without a
  replacement.
* Support `prefers-reduced-motion` by disabling or minimizing
  animations.

## ARIA

* Prefer native HTML semantics over ARIA. A real `<button>` beats
  `role="button"` on a `<div>`.
* Use ARIA only when native semantics do not exist: `aria-expanded`
  on disclosure buttons, `aria-current` on active nav items,
  `role="alert"` for live errors.
* Use `aria-label` only when there is no visible text label.
* Use `aria-live` for dynamic content updates — `polite` for
  non-urgent, `assertive` for urgent.
* Use `aria-invalid` and `aria-describedby` together for form
  validation errors.

## Forms

* Every input must have a visible `<label>` (or `aria-label` for
  icon-only labels).
* Use the correct `type`: `email`, `password`, `search`, `tel`,
  `number`, and so on.
* Show validation errors inline, near the field, with `aria-invalid`
  and `aria-describedby`.
* Announce errors to screen readers with `role="alert"` or
  `aria-live="polite"`.
* Use `autocomplete` attributes where appropriate.
* Minimum touch target: 44×44px for interactive elements.

## Color and contrast

* Text contrast must meet WCAG AA: 4.5:1 for normal text, 3:1 for
  large text (18pt or 14pt bold).
* UI component contrast (borders, icons, focus rings): 3:1 minimum.
* Never rely on color alone to convey meaning — pair color with icons,
  text, or patterns.
* Test both light and dark themes.
* Use the project's OKLCH semantic tokens (`--primary`,
  `--muted-foreground`, and so on) — never hardcode colors.

## Images and media

* Every `<img>` needs meaningful `alt` text. Use `alt=""` for
  decorative images.
* Do not put critical information in images — use real text.
* Provide captions or transcripts for video and audio content.
* Do not autoplay media with sound.

## Motion

* All animations must respect `prefers-reduced-motion: reduce`. Use
  `usePrefersReducedMotion()` from
  `@/hooks/use-prefers-reduced-motion` rather than reading
  `matchMedia` directly, so the check stays SSR-safe, and add
  `motion-reduce:` utilities to CSS transitions.
* Keep animations under 400ms for UI interactions.
* Use `transform` and `opacity` for animations — never animate
  `width`, `height`, `top`, or `left`.
* Use `EASE_OUT_CSS` from `src/lib/ease.ts` for scroll reveals and page
  transitions, not ad-hoc keyframes.
* Do not create flashing content (no more than 3 flashes per second).
* A `backdrop-filter` on an overlay is not free. `Dialog` and
  `AlertDialog` carry `backdrop-blur-sm` because their overlay is static
  and short-lived. `Drawer` deliberately does **not**, because its overlay
  opacity is animated on every frame of a swipe gesture, and a blur
  re-rasterising each frame costs more than the effect is worth on a
  low-power device. Do not add blur to an overlay whose opacity animates.
* Sheet and dialog surfaces animate `transform` and `opacity` only. The
  drawer additionally animates `height` for its snap points, which is
  unavoidable for that component and worth remembering before adding a
  third one.

## Loading and empty states

* Every route whose loader hits the database has a skeleton
  `pendingComponent` that matches the shape of the content, so a slow
  query does not collapse the layout. Use `Skeleton` from
  `src/components/ui/skeleton.tsx`, and mark the container
  `aria-busy="true"`.
* Skeleton what is actually loading, not the whole page. The home page
  keeps its hero and category grid — neither needs data — and stubs only
  the trending and news sections.
* Every list has an `EmptyState` with an icon, a title, a description
  that says what would fill it, and an action where one exists. Use
  `variant="inline"` inside a card, panel, or list region, where the
  default's margins and heading size would dominate.
* Failures use `ErrorState`, which carries `role="alert"` and a retry.
  Field validation errors render inside `FormField`, which sets
  `aria-invalid` and points `aria-describedby` at the message and marks
  it `role="alert"`.
* Anything that updates in place should be inside an `aria-busy`
  container so assistive technology knows the region is in flux.

## Feedback: toast or inline

Deciding *where* a message appears is an accessibility decision, not a
stylistic one. The rule:

* **Action feedback goes to Sonner.** A save, delete, role change, or
  failed request reports on something the person just did. It has no
  field to sit beside, and a toast does not move focus or interrupt a
  screen reader mid-sentence. The `<Toaster>` is mounted once in
  `__root.tsx`.
* **Field-level validation stays inline**, because the message must be
  next to the field and associated with it. `FormField` does both.
* **A retryable load failure stays inline**, because the retry control
  has to be visible where the content failed rather than in a corner that
  may have scrolled away.

An action failure that offers **Try again** must repeat the request that
*failed*, not whatever the form or search field holds when the button is
clicked — otherwise correcting the query and retrying silently re-runs the
old one. Hold the failed query in a ref for the handler to read.

This replaced a shared `FormError` component that every form mounted above
its fields.

## Testing

* Test with keyboard only — every flow must work.
* Test with a screen reader (NVDA, VoiceOver, or axe DevTools).
* Check contrast at all breakpoints and in both themes.
* Verify heading hierarchy and landmark structure.
* Query like a user in tests: `getByRole`, `getByLabelText`,
  `getByText` — never by CSS class.

## Related

* [Custom Theme](../theming/custom-theme.md)
* [Architecture Overview](../architecture/overview.md)
