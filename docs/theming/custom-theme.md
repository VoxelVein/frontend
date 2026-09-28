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

* `--primary` — light `oklch(0.56 0.2185 22.6077)`, dark
  `oklch(0.6122 0.2313 22.6077)`
* `--destructive` — light `oklch(0.55 0.17 40)`, dark
  `oklch(0.7 0.19 40)`

The brand red is a crimson (hue ≈ 23). Destructive actions and errors
use a distinct orange-red (hue 40) and a solid button fill so they do
not blend in with regular primary buttons. Both pass WCAG AA as text on
the page background and with their `-foreground` color on top.

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
