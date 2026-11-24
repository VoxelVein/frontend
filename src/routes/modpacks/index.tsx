import { createFileRoute } from "@tanstack/react-router";

import { legacyProjectRedirect } from "@/lib/legacy-project-redirect";

/** Old /modpacks bookmarks resolve to the project route below /p. */
export const Route = createFileRoute("/modpacks/")({
  beforeLoad: ({ location }) =>
    legacyProjectRedirect({ searchStr: location.searchStr, type: "modpack" }),
});
