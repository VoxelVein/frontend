import { createFileRoute } from "@tanstack/react-router";

import { legacyProjectRedirect } from "@/lib/legacy-project-redirect";

/** Old /servers bookmarks resolve to the project route below /p. */
export const Route = createFileRoute("/servers/")({
  beforeLoad: ({ location }) =>
    legacyProjectRedirect({ searchStr: location.searchStr, type: "server" }),
});
