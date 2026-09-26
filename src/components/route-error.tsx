import { useRouter } from "@tanstack/react-router";
import type { ErrorComponentProps } from "@tanstack/react-router";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { isChunkLoadError, reloadForChunkError } from "@/lib/chunk-reload";

/**
 * Default error boundary for routes. A failed chunk load is fixed by a full
 * page load, so it does that on its own; other errors get retry and reload.
 */
const RouteError = ({ error, reset }: ErrorComponentProps) => {
  const router = useRouter();
  const isChunkError = error instanceof Error && isChunkLoadError(error);

  useEffect(() => {
    if (isChunkError) {
      // Does nothing when it already reloaded moments ago; the message and
      // the reload button below cover that case.
      reloadForChunkError(window.location.href);
    }
  }, [isChunkError]);

  const handleRetry = () => {
    reset();
    void router.invalidate();
  };

  return (
    <section
      aria-labelledby="route-error-heading"
      className="mx-auto max-w-2xl px-4 py-16 sm:px-6"
    >
      <div role="alert" className="bg-card rounded-xl border p-6">
        <h1
          id="route-error-heading"
          className="text-foreground text-lg font-semibold"
        >
          This page could not be loaded
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          {isChunkError
            ? "Loading the latest version of this page… If nothing happens, check your connection and reload."
            : "Something went wrong while loading this page."}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          {isChunkError ? null : (
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={handleRetry}
            >
              Try again
            </Button>
          )}
          <Button
            type="button"
            className="min-h-11"
            onClick={() => window.location.reload()}
          >
            Reload page
          </Button>
        </div>
      </div>
    </section>
  );
};

export { RouteError };
