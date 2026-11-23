import { createFileRoute } from "@tanstack/react-router";

import { legacyProjectRedirect } from "@/lib/legacy-project-redirect";

/** Old /resource-packs bookmarks resolve to the project route below /p. */
export const Route = createFileRoute("/resource-packs/")({
  beforeLoad: ({ location }) =>
    legacyProjectRedirect({
      searchStr: location.searchStr,
      type: "resourcepack",
    }),
});
