# Custom Theme

VoxelVein uses Tailwind CSS v4 with OKLCH semantic tokens. Themes are
sourced from [tweakcn.com](https://tweakcn.com) and applied with the
shadcn CLI. Light and dark mode are driven by `@lonik/themer` and
`<ThemeProvider>` in `src/routes/__root.tsx`.

## Apply a theme

Pick a theme on tweakcn.com and apply it with its identifier:

```bash
pnpm dlx shadcn@latest add \
  https://tweakcn.com/r/themes/{theme-name}.json --yes
```

Replace `{theme-name}` with the identifier from the tweakcn.com URL.

## Brand colors

The current theme is a custom VoxelVein red palette maintained directly
in `src/styles.css`. Re-applying a tweakcn theme overwrites these
values, so re-check them afterwards:

* `--primary` — the specified `#DC143C`, stored as light
  `oklch(0.5712 0.2219 20.0874)` and dark `oklch(0.605 0.2219 20.0874)`
* `--destructive` — light `oklch(0.55 0.17 40)`, dark
  `oklch(0.7 0.19 40)`
* `--background` — light `oklch(0.9811 0.0093 286.2277)`, which is
  exactly `#F8F8FF`; dark `oklch(0.101 0.0084 165.234)`, exactly
  `#020403`

The brand is a crimson at hue ≈ 20, driving `--primary`, `--ring`,
`--chart-1`, `--sidebar-primary` and `--accent` together so nothing can
drift out of agreement with the button colour.

**The dark theme is lighter than the light one, and has to be.** The dark
background is near-black, so the light theme's `#DC143C` sits at 4.12:1
and fails WCAG AA as text. Dark uses lightness `0.605` instead, which
clears it at 4.74:1. One brand colour with two lightnesses is the
alternative to a dark theme whose brand stops being readable; a single
value across both themes does not work here.

Destructive actions and errors stay a distinct orange-red (hue 40,
twenty degrees away) with a solid button fill, so a destructive action
does not blend in with every other brand surface. Both the brand and the
destructive colour pass AA as text on the page background and with their
`-foreground` colour on top.

Both backgrounds are specified hexes, so both are stored as the OKLCH
value that round-trips to them rather than as raw hexes — every token in
the file is OKLCH, and a lone `#F8F8FF` or `#020403` would be the only
thing a reader could not check by eye. Deriving one is a mechanical
conversion: `sRGB → linear → XYZ → OKLab → OKLCH`, then back to confirm
it lands on the same eight-bit triple.

### The light background is off-ladder on purpose

The light neutral ladder — `--secondary`, `--muted`, `--border` — is a
constant chroma `0.002` on hue 70, so it reads as warm paper. The
background is deliberately **not** part of that ladder: at hue 286 and
chroma `0.0093` it is cool and visibly tinted, four and a half times the
ladder's chroma.

The visible consequence is that `bg-muted`, `bg-secondary`, and `bg-card`
sit faintly warm against the cool page. That is the intended look, but
it means a future change to any of those should be judged against the
background that is actually there rather than against the old hue 70
assumption. Every text pairing still passes WCAG AA, and all of them
improved slightly with this background: the tightest is
`--muted-foreground` at 6.63:1.

### Surfaces above the background are not scaled with it

Changing `--background` alone leaves `--card`, `--popover`, `--muted`,
and `--border` where they were, so they sit at a different distance from
the page than before. Darkening the background *increases* their
contrast against it, which is the direction that helps, and the text
tokens all improved: `--foreground` from 19.08:1 to 19.70:1,
`--muted-foreground` from 6.99:1 to 7.22:1, `--primary` from 4.72:1 to
4.87:1.

`--border` is the one token worth naming. It sits at 1.29:1 against the
background, below the 3:1 WCAG 1.4.11 asks of a boundary that is the only
thing identifying a control. That is pre-existing (it was 1.25:1 before)
and this change marginally improves rather than causes it, but it is a
real gap: inputs and unlabelled controls in dark mode rely on a border
that is very nearly invisible. Raise `--border`/`--input` toward
`oklch(0.32 0 0)` if that is addressed.

`--sidebar` mirrors `--background` in both themes, and in dark mode still
holds the old `oklch(0.1398 0 0)`. It is currently referenced by no
component, so nothing renders differently — but it is defined and would
not match the page if a sidebar is ever built from it.

## What the theme changes

The command updates `src/styles.css`:

* `--background`, `--foreground`, and the surface tokens
  (`--card`, `--muted`, `--popover`, ...)
* `--primary` and the accent palette
* `--radius` values
* `--font-sans` and `--font-heading`

## Fonts

The theme may reference a font that is not installed. If the theme sets
`--font-sans` to a font other than Inter, add the fontsource package
and import it in `src/styles.css`:

```bash
pnpm add @fontsource/{font-name}
```

```css
@import "@fontsource/{font-name}";
```

Inter is already installed as `@fontsource-variable/inter`.

## The theme toggle

`src/components/motion/theme-toggle.tsx` is a view-transition theme
switch, not a class swap. It injects one `<style>` tag with four
variants — `rectangle`, `circle`, `blinds`, and `pixel` — and the navbar
uses `pixel`. The `pixel` variant drives `src/components/motion/pixel-reveal.ts`,
which masks `::view-transition-new(root)` frame by frame from
`requestAnimationFrame`.

Every motion path checks `prefers-reduced-motion` and skips the animation
entirely when it is set, so a theme change becomes an instant repaint.

## Verify

After applying a theme:

1. Run `pnpm check` to confirm lint and format compliance.
2. Test components in both light and dark themes.
3. Check contrast at all breakpoints — a theme that passes in light
   mode may fail in dark mode.
4. Check the theme toggle still animates, and that it does not animate
   with `prefers-reduced-motion: reduce`.

## Related

* [Accessibility Standards](../accessibility/standards.md)
* [Commands](../development/commands.md)
