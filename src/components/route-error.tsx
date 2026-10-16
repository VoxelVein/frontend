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
      className="mx-auto max-w-5xl px-4 py-16 sm:px-6"
    >
      <div className="bg-card grid gap-6 rounded-xl border p-6 md:grid-cols-[minmax(0,1fr)_minmax(0,280px)] md:items-center">
        <div>
          <h1
            id="route-error-heading"
            className="text-foreground text-2xl font-semibold tracking-tight"
          >
            This page could not be loaded
          </h1>
          <p className="text-muted-foreground mt-3 text-sm">
            {isChunkError
              ? "Loading the latest version of this page… If nothing happens, check your connection and reload."
              : "Something went wrong while loading this page."}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
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
        <img
          src="https://media1.tenor.com/m/f-Yg-hPcN5UAAAAd/this-is-fine.gif"
          alt="This is fine: a cartoon dog sits in a burning room."
          className="mx-auto w-full max-w-[280px] rounded-lg"
        />
      </div>
    </section>
  );
};

export { RouteError };
