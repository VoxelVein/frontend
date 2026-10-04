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
import { TooltipProvider } from "@/components/ui/tooltip";

import appCss from "../styles.css?url";

const SITE_NAME = "VoxelVein";
const SITE_TITLE = "VoxelVein | Free & Open-Source Minecraft Mod Platform";
// The list matched the hero's own copy rather than the category registry, and
// had already drifted: it omitted datapacks. This description is the one string
// a visitor reads without ever loading the page, so it leads with the promise
// and names the breadth instead of enumerating seven nouns a search result
// truncates anyway.
const SITE_DESCRIPTION =
  "Find, download, and share Minecraft mods, plugins, modpacks, resource packs, shaders, datapacks, and servers. Free and open source, forever.";

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
      {/* Wraps the document rather than each tooltip, so the open delay and the
          one-at-a-time policy are decided once for the whole app. */}
      <TooltipProvider>
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
      </TooltipProvider>
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
        // Matches --background (oklch(0.9779 0.002 70) = #f1eeeb) so the
        // browser chrome does not read whiter than the page behind it.
        name: "theme-color",
        content: "#f1eeeb",
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
      // Icons. Browsers pick the last entry they support, so the .ico goes
      // first as the universal fallback and the scalable SVG goes last.
      //
      // `sizes: "any"` on the .ico is deliberate: the file carries 16/24/32/64
      // internally, and a concrete `sizes` value makes the browser only
      // consider it for that one size and ignore the rest.
      {
        rel: "icon",
        href: "/favicon.ico",
        sizes: "any",
      },
      {
        rel: "icon",
        type: "image/png",
        href: "/favicon-16x16.png",
        sizes: "16x16",
      },
      {
        rel: "icon",
        type: "image/png",
        href: "/favicon-32x32.png",
        sizes: "32x32",
      },
      {
        // favicon.svg, not logo.svg: the SVG icons carry the white border, and
        // logo.svg must stay border-free because the navbar uses it as a CSS
        // mask-image, where a white ring would show up in the header logo.
        rel: "icon",
        type: "image/svg+xml",
        href: "/favicon.svg",
      },
      // iOS Safari ignores favicon.ico for the home screen and screenshots the
      // page instead when this is missing.
      {
        rel: "apple-touch-icon",
        href: "/apple-touch-icon.png",
        sizes: "180x180",
      },
      // Must match the real filename in public/. The android-chrome-*.png
      // icons are only reachable through the manifest, never from a <link>.
      {
        rel: "manifest",
        href: "/site.webmanifest",
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
        Back to homepage
      </Button>
    </div>
  ),
  shellComponent: RootDocument,
});
