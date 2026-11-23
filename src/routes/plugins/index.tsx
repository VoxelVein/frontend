import { createFileRoute } from "@tanstack/react-router";

import { legacyProjectRedirect } from "@/lib/legacy-project-redirect";

/** Old /plugins bookmarks resolve to the project route below /p. */
export const Route = createFileRoute("/plugins/")({
  beforeLoad: ({ location }) =>
    legacyProjectRedirect({ searchStr: location.searchStr, type: "plugin" }),
});
