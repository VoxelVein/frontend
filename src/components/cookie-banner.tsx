import { Link } from "@tanstack/react-router";
import { useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";

const CONSENT_STORAGE_KEY = "voxelvein-cookie-consent";
const CONSENT_EVENT = "voxelvein-cookie-consent-change";

type Consent = "accepted" | "declined";

const subscribe = (onStoreChange: () => void) => {
  window.addEventListener(CONSENT_EVENT, onStoreChange);
  return () => window.removeEventListener(CONSENT_EVENT, onStoreChange);
};

const getSnapshot = (): boolean => {
  const stored = window.localStorage.getItem(CONSENT_STORAGE_KEY);
  return stored === "accepted" || stored === "declined";
};

const getServerSnapshot = (): boolean => false;

const handleChoice = (choice: Consent) => {
  window.localStorage.setItem(CONSENT_STORAGE_KEY, choice);
  window.dispatchEvent(new Event(CONSENT_EVENT));
};

const CookieBanner = () => {
  const hasConsent = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );

  if (hasConsent) {
    return null;
  }

  return (
    <section
      aria-label="Cookie consent"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 p-4"
    >
      <div className="border-border bg-background/95 animate-in fade-in slide-in-from-bottom-2 ease-smooth pointer-events-auto mx-auto max-w-3xl rounded-xl border p-4 duration-300 motion-reduce:animate-none sm:p-5">
        <p className="text-foreground text-sm leading-6">
          We use cookies to keep you signed in and remember your preferences. By
          continuing, you agree to our use of cookies.{" "}
          <Link
            to="/cookies"
            className="text-primary focus-visible:ring-ring rounded-sm hover:underline focus-visible:ring-2 focus-visible:outline-none"
          >
            Learn more
          </Link>
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="default"
            onClick={() => handleChoice("accepted")}
            className="min-h-11"
          >
            Accept
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={() => handleChoice("declined")}
            className="min-h-11"
          >
            Decline
          </Button>
        </div>
      </div>
    </section>
  );
};

export { CookieBanner };
