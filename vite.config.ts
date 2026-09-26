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
