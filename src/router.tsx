import { QueryClient } from "@tanstack/react-query";
import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";

import { RouteError } from "@/components/route-error";
import { reloadForChunkError } from "@/lib/chunk-reload";

import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
      },
    },
  });

  const router = createTanStackRouter({
    defaultErrorComponent: RouteError,

    defaultPreload: "intent",

    defaultPreloadStaleTime: 0,

    routeTree,

    scrollRestoration: true,
  });

  // Vite fires `vite:preloadError` when a chunk's dependencies fail to load
  // (a network blip, or a deploy that replaced the files). Load the page
  // again instead of leaving the navigation stuck.
  if (typeof window !== "undefined") {
    window.addEventListener("vite:preloadError", (event) => {
      if (reloadForChunkError(window.location.href)) {
        event.preventDefault();
      }
    });
  }

  setupRouterSsrQueryIntegration({
    queryClient,
    router,
  });

  return router;
};

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
