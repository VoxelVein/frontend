import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": new URL("src", import.meta.url).pathname,
    },
  },
  test: {
    coverage: {
      exclude: ["src/test/**"],
      include: [
        "src/components/admin/use-admin-posts.ts",
        "src/components/blog/post-card.tsx",
        "src/components/cookie-banner.tsx",
        "src/components/ui/skeleton.tsx",
        "src/components/ui/spinner.tsx",
        "src/hooks/use-post-search.ts",
        "src/lib/auth-validation.ts",
        "src/lib/project-search-cache.ts",
        "src/routes/blog.tsx",
        "src/routes/login.tsx",
        "src/routes/mods.index.tsx",
        "src/routes/signup.tsx",
      ],
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      thresholds: {
        branches: 70,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
    environment: "jsdom",
    exclude: ["node_modules/**", ".opencode/**"],
    globals: true,
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    setupFiles: ["./src/test/setup.ts"],
  },
});
