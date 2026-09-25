# Custom Theme

VoxelVein uses Tailwind CSS v4 with OKLCH semantic tokens. Themes are
sourced from [tweakcn.com](https://tweakcn.com) and applied with the
shadcn CLI.

## Apply a theme

Pick a theme on tweakcn.com and apply it with its identifier:

```bash
pnpm dlx shadcn@latest add \
  https://tweakcn.com/r/themes/{theme-name}.json --yes
```

Replace `{theme-name}` with the identifier from the tweakcn.com URL.
For example, the current theme (Sage Garden) was applied with:

```bash
pnpm dlx shadcn@latest add \
  https://tweakcn.com/r/themes/sage-garden.json --yes
```

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

## Verify

After applying a theme:

1. Run `pnpm check` to confirm lint and format compliance.
2. Test components in both light and dark themes.
3. Check contrast at all breakpoints — a theme that passes in light
   mode may fail in dark mode.

## Related

* [Accessibility Standards](../accessibility/standards.md)
* [Commands](../development/commands.md)
