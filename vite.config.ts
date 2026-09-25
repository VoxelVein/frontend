import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

const config = defineConfig({
  plugins: [devtools(), tailwindcss(), tanstackStart(), nitro(), viteReact()],
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
