import { useTheme } from "@lonik/themer";
import { useEffect, useImperativeHandle, useRef, useState } from "react";
import type { Ref } from "react";

import type { TurnstileAction } from "@/lib/turnstile";
import { getTurnstileSiteKey } from "@/lib/turnstile-client";

// Explicit rendering lets each form keep its widget ID and reset it after a
// failed attempt, because Turnstile tokens are single-use.
const TURNSTILE_SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

interface TurnstileRenderOptions {
  action: TurnstileAction;
  callback: (token: string) => void;
  "error-callback": () => void;
  "expired-callback": () => void;
  size: "flexible";
  sitekey: string;
  theme: "dark" | "light";
}

interface TurnstileApi {
  remove: (widgetId: string) => void;
  render: (
    container: HTMLElement,
    options: TurnstileRenderOptions
  ) => string | undefined;
  reset: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export interface TurnstileWidgetHandle {
  reset: () => void;
}

interface TurnstileWidgetProps {
  action: TurnstileAction;
  onTokenChange: (token: string | null) => void;
  ref?: Ref<TurnstileWidgetHandle>;
}

let turnstilePromise: Promise<TurnstileApi> | null = null;

const loadTurnstile = (): Promise<TurnstileApi> => {
  if (window.turnstile) {
    return Promise.resolve(window.turnstile);
  }

  // oxlint-disable-next-line promise/avoid-new -- Wraps the script element's load/error events, which have no promise-based API.
  turnstilePromise ??= new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = TURNSTILE_SCRIPT_SRC;
    script.async = true;
    script.addEventListener("load", () => {
      if (window.turnstile) {
        resolve(window.turnstile);
      } else {
        reject(new Error("Turnstile script loaded without its API."));
      }
    });
    script.addEventListener("error", () => {
      turnstilePromise = null;
      script.remove();
      reject(new Error("Could not load the Turnstile script."));
    });
    document.head.append(script);
  });

  return turnstilePromise;
};

const TurnstileWidget = ({
  action,
  onTokenChange,
  ref,
}: TurnstileWidgetProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onTokenChangeRef = useRef(onTokenChange);
  const [hasError, setHasError] = useState(false);
  const { resolvedTheme } = useTheme();
  const theme = resolvedTheme === "dark" ? "dark" : "light";
  const siteKey = getTurnstileSiteKey();

  useEffect(() => {
    onTokenChangeRef.current = onTokenChange;
  }, [onTokenChange]);

  useImperativeHandle(
    ref,
    () => ({
      reset: () => {
        onTokenChangeRef.current(null);
        if (widgetIdRef.current && window.turnstile) {
          window.turnstile.reset(widgetIdRef.current);
        }
      },
    }),
    []
  );

  useEffect(() => {
    if (!siteKey) {
      return;
    }

    let isCancelled = false;

    const renderWidget = async () => {
      try {
        const turnstile = await loadTurnstile();
        const container = containerRef.current;
        if (isCancelled || !container) {
          return;
        }
        setHasError(false);
        widgetIdRef.current =
          turnstile.render(container, {
            action,
            callback: (token) => {
              setHasError(false);
              onTokenChangeRef.current(token);
            },
            "error-callback": () => {
              setHasError(true);
              onTokenChangeRef.current(null);
            },
            "expired-callback": () => onTokenChangeRef.current(null),
            sitekey: siteKey,
            size: "flexible",
            theme,
          }) ?? null;
      } catch {
        if (!isCancelled) {
          setHasError(true);
        }
      }
    };

    void renderWidget();

    return () => {
      isCancelled = true;
      onTokenChangeRef.current(null);
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
      }
      widgetIdRef.current = null;
    };
  }, [action, siteKey, theme]);

  if (!siteKey) {
    return null;
  }

  return (
    <div className="grid gap-2">
      <div ref={containerRef} className="min-h-16" />
      {hasError ? (
        <p role="alert" className="text-destructive text-sm">
          Human verification couldn&apos;t load. Check your connection or
          disable content blockers, then reload the page.
        </p>
      ) : null}
    </div>
  );
};

export { TurnstileWidget };
