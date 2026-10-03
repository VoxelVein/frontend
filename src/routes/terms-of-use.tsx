import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * `/terms-of-use` used to be a second, shorter set of terms living alongside
 * `/terms`, with its own warranty-free wording and its own account rules. Three
 * overlapping legal pages ("Terms", "Terms of Use", "Disclaimer") meant a
 * reader could not tell which one governed them.
 *
 * `/terms` is now the single binding document, so this path redirects there.
 * It stays as a route rather than a 404 so external links and anything already
 * indexed keep resolving, and so an old bookmark lands on real terms.
 */
export const Route = createFileRoute("/terms-of-use")({
  beforeLoad: () => {
    throw redirect({ to: "/terms" });
  },
});
