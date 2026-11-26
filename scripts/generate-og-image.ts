/**
 * Renders `public/og-image.png`, the 1200x630 social share card referenced by
 * `og:image` and `twitter:image` in `src/routes/__root.tsx`.
 *
 * The image is committed, so this only needs re-running when the logo, name or
 * tagline changes: `pnpm og:image`.
 *
 * librsvg (through sharp) cannot load the Inter web font the site ships, so
 * the text falls back through a system sans-serif stack. That is acceptable
 * for a share card; check the output visually after regenerating.
 */
import path from "node:path";

import sharp from "sharp";

const OUTPUT = path.resolve("public/og-image.png");

const OG_IMAGE_WIDTH = 1200;
const OG_IMAGE_HEIGHT = 630;

// Matches the dark theme: --background #0a0a0a, with the white logo variant.
const BACKGROUND = "#0a0a0a";
const FOREGROUND = "#ffffff";
const MUTED = "#a1a1a1";
const FONT_STACK = "Inter, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif";

// Same paths as public/logo-dark.svg, viewBox 0 0 48 43.
const LOGO_PATHS = `
  <path d="M5.258 42.839c11.83 0 21.419-9.59 21.419-21.42S17.087 0 5.257 0c-11.829 0 .001 9.59.001 21.42 0 11.829-11.83 21.419 0 21.419" fill="${FOREGROUND}"/>
  <path d="M42.742 42.839c-11.83 0-21.419-9.59-21.419-21.42S30.913 0 42.743 0c11.829 0-.001 9.59-.001 21.42 0 11.829 11.83 21.419 0 21.419" fill="${FOREGROUND}"/>
  <circle cx="24" cy="21.421" r="5.355" fill="${BACKGROUND}"/>
`;

const LOGO_SCALE = 4;
const LOGO_WIDTH = 48 * LOGO_SCALE;
const LOGO_X = (OG_IMAGE_WIDTH - LOGO_WIDTH) / 2;
const LOGO_Y = 130;

const svg = `
<svg width="${OG_IMAGE_WIDTH}" height="${OG_IMAGE_HEIGHT}" viewBox="0 0 ${OG_IMAGE_WIDTH} ${OG_IMAGE_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="${BACKGROUND}"/>
  <g transform="translate(${LOGO_X} ${LOGO_Y}) scale(${LOGO_SCALE})">${LOGO_PATHS}</g>
  <text x="50%" y="420" text-anchor="middle" font-family="${FONT_STACK}" font-size="84" font-weight="700" fill="${FOREGROUND}">VoxelVein</text>
  <text x="50%" y="490" text-anchor="middle" font-family="${FONT_STACK}" font-size="36" fill="${MUTED}">Free &amp; open-source Minecraft mod platform</text>
</svg>
`;

await sharp(Buffer.from(svg))
  .png({ compressionLevel: 9, palette: true })
  .toFile(OUTPUT);

console.log(`Wrote ${OUTPUT}`);
