import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";

// Node 26's experimental global localStorage (requires --localstorage-file)
// shadows jsdom's window.localStorage in the vitest jsdom environment.
// Provide a simple in-memory implementation for tests.
if (window.localStorage === undefined) {
  const store = new Map<string, string>();

  const localStorageMock: Storage = {
    clear: () => {
      store.clear();
    },
    getItem: (key: string) => store.get(key) ?? null,
    key: (index: number) => [...store.keys()][index] ?? null,
    get length() {
      return store.size;
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
  };

  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: localStorageMock,
  });
}

// Vite loads .env.local in tests too. Keep Turnstile off by default so tests
// don't depend on a developer's local env; Turnstile tests stub the key.
beforeEach(() => {
  vi.stubEnv("VITE_TURNSTILE_SITE_KEY", "");
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});
