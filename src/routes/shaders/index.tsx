import { createFileRoute } from "@tanstack/react-router";

import { legacyProjectRedirect } from "@/lib/legacy-project-redirect";

/** Old /shaders bookmarks resolve to the project route below /p. */
export const Route = createFileRoute("/shaders/")({
  beforeLoad: ({ location }) =>
    legacyProjectRedirect({ searchStr: location.searchStr, type: "shader" }),
});
