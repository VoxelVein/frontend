import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import type { ServerOptions } from "vite";
import { defineConfig, loadEnv } from "vite";

const config = defineConfig(({ command, mode }) => {
  const isDevelopment = command === "serve" && mode === "development";
  const env = loadEnv(mode, process.cwd(), "");

  const server: ServerOptions = {
    // PORT is the single "where do I listen" variable, shared with the Nitro
    // production server. Local `pnpm dev` falls back to 3000; the Docker
    // compose files set it to 6001.
    port: Number(process.env.PORT ?? 3000),
    // Dev origins are hardcoded (better-auth trustedOrigins, CORS), so
    // silently drifting to 3001 when 3000 is busy would break sign-in. Fail
    // loudly.
    strictPort: true,
  };

  if (isDevelopment) {
    // Keep the event stream same-origin in local development. Browsers then
    // avoid a CORS request to the separate Elysia process, while Vite forwards
    // the stream to the configured API server.
    server.proxy = {
      "/api/events": {
        target: env.API_URL ?? "http://localhost:3002",
        changeOrigin: true,
        configure: (proxy) => {
          // EventSource streams are long-lived. Closing a browser tab aborts
          // the proxied request, and http-proxy reports that as `aborted` /
          // ECONNRESET. It is the expected end of a stream, not a proxy
          // failure, so it should not print a stack trace on every reload.
          proxy.on("error", (error) => {
            if (
              "code" in error &&
              (error.code === "ECONNRESET" || error.code === "ECONNABORTED")
            ) {
              return;
            }

            if (error.message === "aborted") {
              return;
            }

            console.error("[vite] /api/events proxy error:", error);
          });
        },
      },
    };
  }

  // The dev server does not tree-shake. Server functions become RPC stubs, but
  // a helper left outside a handler keeps its server-only import alive in the
  // dev client graph, which pre-bundles `pg` and crashes on `Buffer.from`.
  // Production drops that import while tree-shaking, so the deny rule is
  // dev-only: keeping it in the build would flag code that never ships.
  const importProtection = isDevelopment
    ? {
        client: {
          specifiers: ["@/db", "@/lib/auth", "drizzle-orm/node-postgres"],
        },
      }
    : undefined;

  return {
    plugins: [
      ...(isDevelopment ? [devtools()] : []),
      tailwindcss(),
      tanstackStart({ importProtection }),
      nitro({
        experimental: { tasks: true },
        // Hourly, so an account is purged within an hour of its grace period
        // ending. The task is idempotent, so a missed run only delays it.
        // Local dev commonly runs without PostgreSQL. Do not trigger a noisy
        // scheduled database job there; the scheduler is for deployed servers.
        scheduledTasks: isDevelopment
          ? {}
          : { "0 * * * *": ["accounts:purge"] },
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
      rollupOptions: {
        // The DB, its schema, the auth instance and the env loader are
        // server-only. Start rewrites each `.functions.ts` module down to its
        // client RPC stubs, but with `verbatimModuleSyntax` those modules'
        // imports are preserved even once nothing references them. Because a
        // `pgTable(...)` or `new Pool()` module looks side-effectful, tree-
        // shaking kept them in the entry chunk along with `drizzle-orm`, `pg`
        // and `dotenv`  -  none of which the browser ever calls. `pg-types`
        // then threw `Buffer is not defined` on load and hydration died.
        //
        // Declaring these modules side-effect-free lets unused imports be
        // dropped. Modules genuinely used by the client bridge are still kept,
        // and the server build still evaluates them normally.
        treeshake: {
          // Ids are absolute Windows paths here, so normalise before matching.
          // Without that the schema predicate above never fired and the whole
          // Postgres client ended up in the browser build, where `pg-types`
          // calls `Buffer.from` on load and kills hydration.
          moduleSideEffects: (id) => {
            const normalized = id.replaceAll("\\", "/");

            return ![
              "/src/db/schema.ts",
              "/src/db/index.ts",
              "/src/lib/auth.ts",
              "/src/env.config.ts",
            ].some((suffix) => normalized.endsWith(suffix));
          },
        },
      },
    },
    server,
  };
});

export default config;
