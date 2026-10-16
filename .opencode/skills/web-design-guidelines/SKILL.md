---
name: web-design-guidelines
description: Review UI code for Web Interface Guidelines compliance. Use when asked to "review my UI", "check accessibility", "audit design", "review UX", or "check my site against best practices".
version: 2.0.0
author: vercel
type: skill
category: design
tags:
  - ui
  - ux
  - accessibility
  - review
  - design
  - loading
  - skeletons
  - empty-states
  - design-system
---

# Web Design Guidelines

**Purpose**: Review UI code for compliance with the Web Interface Guidelines and the project's design system.

## How to Use Me

1. **Fetch the guidelines**  -  retrieve the latest rules from Vercel Labs:
   `https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md`
2. **Read the files**  -  read the specified files, or ask the user which files to review.
3. **Apply the rules**  -  check the files against the fetched guidelines **and** the project rules below.
4. **Output findings**  -  use the terse `file:line` format specified in the fetched guidelines.

---

## Non-Negotiable Rules

### 1. Never Use Native UI Components When a shadcn/ui Equivalent Exists

This project uses shadcn-style components built on Base UI. When a shadcn
component exists, **use it**  -  never hand-roll a native replacement.

Where the project has shadcn components available, use them for:

- Button
- Input (via `FormField`)
- Textarea
- Select
- Checkbox
- Switch
- Radio Group
- Dialog
- Drawer
- Sheet
- Popover
- Tooltip
- Dropdown Menu
- Context Menu
- Alert Dialog
- Tabs
- Accordion
- Avatar
- Badge
- Separator
- Card
- Scroll Area
- Skeleton
- Toast
- Progress
- Form components

Clarifications:

- **Semantic HTML is still required** where appropriate: `main`, `nav`,
  `header`, `section`, `article`, `aside`, `footer`, `button`, `a`, `form`,
  `label`, `table`. These are not "native UI controls"  -  they are the
  structural backbone of an accessible page.
- **Native elements are allowed** only when no shadcn abstraction exists
  (e.g. a plain `<input>` inside `FormField`, a native `<select>` when no
  shadcn Select exists) or when semantic HTML is required.
- **Never create custom replacements** for existing shadcn components. If a
  shadcn component exists, extend or compose it  -  do not fork it.
- **Never introduce another component library.** Reuse the existing
  `src/components/ui/*` primitives.

### 2. Preserve Accessibility While Improving Visuals

Every visual change must keep WCAG 2.2 AA compliance. If a change breaks
a11y, it is a regression, not an improvement. See the Accessibility section
below.

### 3. Reuse the Design System

- Use OKLCH semantic tokens (`--primary`, `--muted`, `--card`, `--popover`,
  `--destructive`, `--ring`, `--border`, `--input`, etc.)  -  never hardcode
  colors.
- Use the Tailwind spacing scale (`gap-*`, `p-*`, `m-*`)  -  never arbitrary
  pixel values.
- Use `font-heading` for display/headings, default font for body.
- Use the project's motion utilities (`EASE_OUT_CSS` from `src/lib/ease.ts`)
  with CSS transitions  -  not CSS keyframes.

---

## Design Tokens & Theming

- **Colors**: always OKLCH semantic tokens. Never raw hex, never Tailwind
  palette grays. Test every component in both light and dark themes.
- **Surfaces**: use `bg-card`, `bg-muted`, `bg-popover` for surface
  differentiation  -  not arbitrary grays.
- **Text**: `text-foreground` for primary, `text-muted-foreground` for
  secondary/helper text.
- **Borders**: `border-border` for separators; `border-border/70` for
  subtler dividers inside popovers/menus.
- **Radius**: use the token scale (`rounded-sm` → `rounded-4xl`). Cards use
  `rounded-xl`; buttons/inputs use `rounded-lg`; pills/badges use
  `rounded-full`.
- **Shadows**: the project defines `--shadow-soft` and `--shadow-glow`, but
  **do not add shadows speculatively**  -  keep surfaces flat with
  `bg-card`/`bg-muted` and `border` for separation unless the design
  explicitly calls for elevation.

---

## Component Consistency

- Prefer shadcn/Base UI primitives over hand-rolled equivalents.
- **Cards**: `rounded-xl border bg-card` with `p-6` padding. Hover states
  use `hover:bg-muted/50` or border emphasis  -  never dramatic transforms.
- **Buttons**: `default` for primary actions, `outline` for secondary,
  `ghost` for tertiary, `destructive` for danger. Sizes: `default`, `sm`,
  `lg`, `icon`, `icon-sm`.
- **Forms**: label above input, helper text below, inline validation errors
  with `aria-invalid` + `aria-describedby`.
- **Lists**: consistent item padding (`p-3`), `gap-3` between items,
  `bg-muted/40` item backgrounds with `border-border` borders.
- **Empty states**: icon + title + description + optional action button.
- **Loading states**: skeleton placeholders or `aria-busy` spinners  -  never
  blank flashes.

---

## Visual Hierarchy

- One `<h1>` per page. Use `<h2>` → `<h3>` hierarchy without skipping levels.
- Page headers: `text-2xl`/`text-3xl` heading + `text-muted-foreground`
  subtitle below (`mt-1.5`).
- Section titles: `text-lg`/`text-xl` with `font-semibold`.
- Card titles: `text-sm`/`text-base` with `font-medium`.
- Use `text-muted-foreground` to de-emphasize secondary information  -  never
  rely on size alone.
- Keep line lengths readable: `max-w-prose` for long-form text, `max-w-2xl`
  for forms, `max-w-7xl` for page containers.

---

## Spacing System

- Use the Tailwind spacing scale exclusively  -  no arbitrary pixel values.
- Consistent section rhythm: `py-16`/`py-24` for major sections,
  `gap-8`/`gap-12` between blocks.
- Card padding: `p-6`. List items: `p-3`. Dialog content: `p-4` with
  `gap-4` between sections.
- Form fields: `grid gap-2` between label/input/helper.
- Button groups: `gap-2` between buttons; `flex-col-reverse sm:flex-row
  sm:justify-end` for dialog footers on mobile.
- Touch targets: minimum **44×44px** for interactive elements.

---

## Typography

- Use `font-heading` for display/headings, default font for body.
- Heading scale: `text-4xl`/`text-5xl` for hero, `text-2xl`/`text-3xl` for
  section titles, `text-lg`/`text-xl` for card titles.
- Body: `text-sm`/`text-base`; helper text `text-xs`/`text-sm` with
  `text-muted-foreground`.
- Use `tracking-tight` on large headings, `text-balance` on multi-line
  headings.
- Keep line lengths readable: `max-w-prose` for long-form text.
- Never hardcode gray  -  use `text-muted-foreground`.

---

## Border Radius Usage

- **Cards**: `rounded-xl`.
- **Buttons/inputs/selects**: `rounded-lg`.
- **Pills/badges/tags**: `rounded-full`.
- **Dialogs**: `rounded-xl`.
- **Drawers**: `rounded-t-xl` (bottom sheet), `rounded-r-xl`/`rounded-l-xl`
  (side sheet).
- **Avatars**: `rounded-full`.
- **Icons in boxes**: `rounded-lg` for 40px boxes, `rounded-md` for smaller.

---

## Shadows

- Default to flat surfaces: `bg-card`/`bg-muted` + `border` for separation.
- Use `--shadow-soft` only when a subtle elevation is needed (e.g. floating
  elements).
- Never add `shadow-*`, `drop-shadow`, `blur-*`, or glow effects
  speculatively  -  only when the design explicitly requests them.

---

## States

### Hover States

- Subtle transitions: `transition-colors`, `hover:bg-muted/50`.
- Avoid dramatic scale/translate on hover for standard controls.
- Buttons may use `hover:-translate-y-0.5` + `active:scale-[0.98]` for
  primary CTAs only, with `motion-reduce:transform-none`.

### Focus States

- Visible focus indicators are mandatory: `focus-visible:ring-3
  focus-visible:ring-ring/50`.
- Never remove `outline` without a replacement.
- Focus rings must meet 3:1 contrast against the adjacent background.

### Loading States

- Skeletons (`src/components/ui/skeleton.tsx`) for content regions, with
  `aria-busy="true"` on the container.
- Spinners (`src/components/ui/spinner.tsx`) for in-button async actions.
- Route navigation: use a route `pendingComponent` so client-side
  transitions show skeletons instead of content popping in.
- Every async region must render one of: content, skeleton, empty state, or
  error  -  never nothing.

### Empty States

- Icon + clear title + short description + optional action button
  (e.g. "Clear filters").
- Never leave a list or search area blank.

### Error States

- Inline errors near the relevant UI with `role="alert"`.
- Form validation: `aria-invalid` + `aria-describedby` on the input, error
  text below the field.
- Async errors: inline alert with an actionable retry button where possible.

---

## Destructive Actions

- Use the `destructive` variant (red) for irreversible/dangerous actions  - 
  reserve it for that purpose only.
- Destructive confirmations require a Dialog with explicit warning text  - 
  never a single click.
- Use `ConfirmDialog` (`src/components/ui/confirm-dialog.tsx`) for
  destructive confirmations.
- In destructive dialogs: confirm button is `variant="destructive"`, cancel
  is `variant="outline"`.
- Never use destructive styling for reversible actions.

---

## Animations & Motion

- Keep animations under **400ms** for UI interactions.
- Use `transform`/`opacity` only  -  never animate `width`/`height`/`top`/
  `left`.
- Use CSS transitions with `EASE_OUT_CSS` for scroll reveals and page
  transitions  -  not CSS keyframes. Use `usePrefersReducedMotion()` from
  `@/hooks/use-prefers-reduced-motion` for reduced-motion support.
- Use the project's easing constants from `src/lib/ease.ts` (`EASE_OUT`,
  `EASE_IN_OUT`, `EASE_DRAWER`) and spring configs (`SPRING_PRESS`,
  `SPRING_SWAP`, `SPRING_PANEL`, `SPRING_LAYOUT`).
- Respect `prefers-reduced-motion`  -  use `usePrefersReducedMotion()` from
  `@/hooks/use-prefers-reduced-motion` and disable or minimize all animations.
- Don't create flashing content (WCAG 2.3.1  -  no more than 3 flashes per
  second).

---

## Accessibility

- **Semantic HTML**: use `main`, `nav`, `header`, `section`, `article`,
  `aside`, `footer`, `button`, `a`, `form`, `label`, `table`. Never `div`
  soup.
- **Landmarks**: exactly one `<main>` per page; `<nav aria-label="...">`
  when multiple nav regions exist; `<section aria-labelledby="...">` to
  associate sections with headings.
- **Keyboard**: all interactive elements reachable and operable via keyboard
  (Tab, Enter, Space, Arrow keys). Never trap focus  -  dialogs must close on
  Esc and return focus to the trigger.
- **ARIA**: prefer native semantics over ARIA. Use `aria-label` only when
  there's no visible text label. Use `aria-live` for dynamic content
  updates. Use `aria-describedby` to associate helper text with inputs.
- **Forms**: every input needs a visible `<label>` (or `aria-label` if
  icon-only). Use `type` correctly (`email`, `password`, `search`, etc.).
  Use `autocomplete` attributes where appropriate.
- **Contrast**: text ≥ 4.5:1 (WCAG AA), large text ≥ 3:1, UI components
  (borders, icons, focus rings) ≥ 3:1. Test both themes.
- **Images**: meaningful `alt` text; `alt=""` for decorative images.
- **Reduced motion**: all animations must respect
  `prefers-reduced-motion: reduce`.
- **Test**: keyboard-only, screen reader (NVDA/VoiceOver/axe), contrast at
  all breakpoints and in both themes.

---

## Mobile-First Responsiveness

- Design for small screens first, enhance with `sm:`/`md:`/`lg:` breakpoints.
- Touch targets ≥ 44×44px on mobile.
- Use `lg:hidden`/`hidden lg:flex` for responsive nav/menus  -  never
  JS-based breakpoint detection.
- Dialog footers: `flex-col-reverse gap-2 sm:flex-row sm:justify-end`.
- Test at 320px, 375px, 768px, 1024px, and 1440px.

---

## Dialog/Drawer Usage

- Use `Dialog` (`src/components/ui/dialog.tsx`) for centered modals.
- Use `Drawer` (`src/components/ui/drawer.tsx`) for bottom sheets on mobile
  and side sheets on desktop.
- **Structure**: `DialogHeader` (title + description) → content →
  `DialogFooter` (actions).
- **Titles**: `DialogTitle` with `font-heading text-base font-medium`.
- **Descriptions**: `DialogDescription` with `text-muted-foreground text-sm`.
- **Footers**: `DialogFooter` with `flex-col-reverse gap-2 sm:flex-row
  sm:justify-end`; primary action last (rightmost on desktop, topmost on
  mobile).
- **Destructive**: confirm button `variant="destructive"`, cancel
  `variant="outline"`.
- **Close**: `showCloseButton` on `DialogContent` for the X button; Esc to
  close; focus returns to trigger on close.
- **Scroll**: `overscroll-contain` on content; keep the dialog within
  `max-w-[calc(100%-2rem)]` on mobile.
- **Backdrop**: `bg-black/10` with fade-in/out; never fully opaque.
- **Elevation**: dialogs sit at `z-50` above all page content.

---

## Icon Usage

- Use `@tabler/icons-react`  -  the project's icon set.
- Consistent stroke: `stroke={1.8}` for UI icons, `stroke={2}` for small
  inline badges.
- Sizes: `size={16}` for menu items, `size={18}` for list item icons,
  `size={20}`+ for feature icons.
- Decorative icons: `aria-hidden="true"`.
- Icon-only buttons: `sr-only` label or `aria-label`.
- Never mix icon sets.

---

## Color Usage

- Always OKLCH semantic tokens  -  never raw hex.
- `--primary` (green) for primary actions and active states.
- `--destructive` (red) for irreversible/dangerous actions only.
- `--muted-foreground` for secondary/helper text.
- `--muted`/`--card`/`--popover` for surface differentiation.
- Never rely on color alone to convey meaning  -  pair color with icons,
  text, or patterns.
- Test both light and dark themes  -  contrast that passes in one may fail
  in the other.

---

## Surface/Background Layering

- **Page background**: `bg-background`.
- **Cards**: `bg-card` with `border-border`  -  the default content surface.
- **Muted regions**: `bg-muted`/`bg-muted/40` for list items, secondary
  regions, and footer areas.
- **Popovers/menus/dialogs**: `bg-popover` with `border-border` and
  `ring-1 ring-foreground/10` for elevation.
- **Overlays**: `bg-black/10` for dialog/drawer backdrops.
- Keep layering flat  -  use borders and subtle background shifts, not
  shadows, to separate surfaces.

---

## Loading Skeletons and Empty States

Always check for loading and empty states when reviewing a page:

- **Loading skeletons**: while data is loading, show skeleton placeholders
  (see `src/components/ui/skeleton.tsx`) instead of a blank flash or content
  popping in. Mark the container `aria-busy="true"`. For route navigation,
  use a route `pendingComponent` so client-side transitions show skeletons
  instead of the previous page lingering or content popping in.
- **Empty states**: when a list or search returns no results, show an empty
  state with an icon, a clear title, a short description, and an optional
  action button (e.g. "Clear filters"). Never leave the area blank.
- **Error states**: show inline errors near the relevant UI with
  `role="alert"` and an actionable retry where possible.
- **No blank flashes**: every async region must render one of: content,
  skeleton, empty state, or error  -  never nothing.

---

## Review Checklist

When reviewing UI, check in this order:

1. **shadcn-only rule**  -  native controls replaced with shadcn equivalents?
2. **Semantic HTML & landmarks**  -  one `<main>`, proper `<section>`/
   `<nav>`/`<header>` usage, heading hierarchy?
3. **Design tokens**  -  OKLCH tokens only, no hardcoded colors/grays?
4. **Spacing & radius**  -  Tailwind scale, consistent `rounded-*` usage?
5. **States**  -  hover, focus, loading, empty, error all handled?
6. **Destructive actions**  -  confirm dialogs, destructive variant only for
   danger?
7. **Motion**  -  under 400ms, transform/opacity only, reduced-motion
   respected?
8. **Accessibility**  -  keyboard nav, focus visibility, ARIA, contrast,
   screen-reader labels?
9. **Responsive**  -  mobile-first, 44px touch targets, breakpoint behavior?
10. **Consistency**  -  matches existing components, no parallel
    implementations?

## Tips

- Always fetch fresh guidelines before each review  -  the rules change over time
- Use the terse `file:line` output format for findings
- Ask the user which files to review if none are specified
- When a finding has a fix, suggest the exact shadcn component or token to use