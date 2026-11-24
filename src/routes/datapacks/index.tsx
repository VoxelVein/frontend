import { createFileRoute } from "@tanstack/react-router";

import { legacyProjectRedirect } from "@/lib/legacy-project-redirect";

/** Old /datapacks bookmarks resolve to the project route below /p. */
export const Route = createFileRoute("/datapacks/")({
  beforeLoad: ({ location }) =>
    legacyProjectRedirect({ searchStr: location.searchStr, type: "datapack" }),
});
