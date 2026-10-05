import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

const config = defineConfig({
  plugins: [
    devtools(),
    tailwindcss(),
    tanstackStart(),
    nitro({
      experimental: { tasks: true },
      // Keep `isomorphic-dompurify` out of the server bundle so Node loads it
      // from node_modules instead.
      //
      // Nitro 3 inlines every dependency unless it is listed here — the
      // externals plugin is a no-op with an empty `traceDeps`, not an
      // allowlist-by-default. That inlining is what broke Markdown rendering
      // in production: the Node build of the package constructs a JSDOM window
      // at import time, and jsdom reads its `default-stylesheet.css` through
      // `__dirname`. Rollup converted jsdom's CommonJS to ESM with lazy
      // `require_*` proxies but cannot define `__dirname`, so the first
      // `sanitize()` call threw `__dirname is not defined in ES module scope`
      // and every SSR request 500'd. Loading the real package lets Node
      // evaluate jsdom as CommonJS, where `__dirname` exists.
      //
      // The browser build is unaffected — the client resolves the `browser`
      // export condition, which is plain DOMPurify with no jsdom, so this adds
      // nothing to the client bundle.
      traceDeps: ["isomorphic-dompurify"],
      // Hourly, so an account is purged within an hour of its grace period
      // ending. The task is idempotent, so a missed run only delays it.
      scheduledTasks: { "0 * * * *": ["accounts:purge"] },
      tasks: {
        "accounts:purge": {
          // Absolute: Nitro resolves task handlers from a virtual module.
          handler: fileURLToPath(
            new URL("src/tasks/purge-accounts.ts", import.meta.url)
          ),
        },
      },
    }),
    viteReact(),
  ],
  resolve: { tsconfigPaths: true },
  build: {
    // Off by default: a sourcemap roughly doubles the build's output. Set
    // BUNDLE_SOURCEMAP=1 when running `pnpm analyze:bundle`, which needs it to
    // attribute entry-chunk bytes to their sources.
    sourcemap: process.env.BUNDLE_SOURCEMAP === "1",
  },
  server: {
    // PORT is the single "where do I listen" variable, shared with the Nitro
    // production server. Local `pnpm dev` falls back to 3000; the Docker
    // compose files set it to 6001.
    port: Number(process.env.PORT ?? 3000),
    // Dev origins are hardcoded (better-auth trustedOrigins, CORS), so silently
    // drifting to 3001 when 3000 is busy would break sign-in. Fail loudly.
    strictPort: true,
  },
});

export default config;
