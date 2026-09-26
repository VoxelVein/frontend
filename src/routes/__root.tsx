import { ThemeProvider } from "@lonik/themer";
import { IconHome } from "@tabler/icons-react";
import { TanStackDevtools } from "@tanstack/react-devtools";
import {
  HeadContent,
  Link,
  Scripts,
  createRootRoute,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import type { ReactNode } from "react";

import { CookieBanner } from "@/components/cookie-banner";
import { Footer } from "@/components/footer";
import { Navbar } from "@/components/navbar/navbar";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";

import appCss from "../styles.css?url";

const SITE_NAME = "VoxelVein";
const SITE_TITLE = "VoxelVein — Free & Open-Source Minecraft Mod Platform";
const SITE_DESCRIPTION =
  "Discover, install, and share Minecraft mods, resource packs, modpacks, shaders, plugins, and servers — free and open source, forever.";

// Absolute origin, no trailing slash. Read from import.meta.env rather than
// env.config so the value is inlined at build time and available during SSR
// and client navigation alike; a wrong host here would ship bad social
// previews, so VITE_SITE_URL must be set for real deployments.
// SAFETY: Vite exposes VITE_* vars as `any`; narrowing to string | undefined
// matches the runtime value (string when set, undefined when absent).
const SITE_URL = (
  (import.meta.env.VITE_SITE_URL as string | undefined) ??
  "http://localhost:3000"
).replace(/\/$/u, "");

const RootDocument = ({ children }: { children: ReactNode }) => (
  <html lang="en" suppressHydrationWarning>
    <head>
      <HeadContent />
    </head>
    <body>
      <ThemeProvider storageKey="voxelvein-theme" defaultTheme="system">
        <a
          href="#main-content"
          className="focus:ring-ring focus:bg-background sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-lg focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:ring-2 focus:outline-none"
        >
          Skip to content
        </a>
        <Navbar />
        <main id="main-content">{children}</main>
        <Footer />
      </ThemeProvider>
      <CookieBanner />
      <Toaster richColors position="bottom-right" />
      <TanStackDevtools
        config={{
          position: "bottom-left",
          triggerMode: "fixed",
          hideUntilHover: true,
        }}
        plugins={[
          {
            name: "Tanstack Router",
            render: <TanStackRouterDevtoolsPanel />,
          },
        ]}
      />
      <Scripts />
    </body>
  </html>
);

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: SITE_TITLE,
      },
      {
        name: "description",
        content: SITE_DESCRIPTION,
      },
      {
        name: "application-name",
        content: SITE_NAME,
      },
      {
        name: "author",
        content: SITE_NAME,
      },
      {
        name: "referrer",
        content: "strict-origin-when-cross-origin",
      },
      {
        name: "theme-color",
        content: "#ffffff",
        media: "(prefers-color-scheme: light)",
      },
      {
        name: "theme-color",
        content: "#0a0a0a",
        media: "(prefers-color-scheme: dark)",
      },

      // Open Graph. og:image is intentionally absent: there is no share image
      // in public/, and pointing at a missing file makes some scrapers cache a
      // broken preview. Add one and fill this in alongside it.
      {
        property: "og:type",
        content: "website",
      },
      {
        property: "og:site_name",
        content: SITE_NAME,
      },
      {
        property: "og:title",
        content: SITE_TITLE,
      },
      {
        property: "og:description",
        content: SITE_DESCRIPTION,
      },
      {
        property: "og:url",
        content: SITE_URL,
      },
      {
        property: "og:locale",
        content: "en_US",
      },

      {
        name: "twitter:card",
        content: "summary",
      },
      {
        name: "twitter:title",
        content: SITE_TITLE,
      },
      {
        name: "twitter:description",
        content: SITE_DESCRIPTION,
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      {
        rel: "icon",
        href: "/favicon.ico",
        sizes: "32x32",
      },
      {
        rel: "manifest",
        href: "/manifest.json",
      },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: SITE_NAME,
          url: SITE_URL,
          description: SITE_DESCRIPTION,
        }),
      },
    ],
  }),
  notFoundComponent: () => (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center px-4 py-24 text-center sm:px-6">
      <p className="text-primary text-sm font-semibold tracking-wide uppercase">
        404
      </p>
      <h1 className="text-foreground mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
        Page not found
      </h1>
      <p className="text-muted-foreground mt-3 max-w-md text-sm sm:text-base">
        The page you are looking for does not exist or has been moved. Check the
        URL or head back to the homepage.
      </p>
      <Button render={<Link to="/" />} className="mt-8 min-h-11 px-6">
        <IconHome size={16} aria-hidden="true" />
        Back to Home
      </Button>
    </div>
  ),
  shellComponent: RootDocument,
});
