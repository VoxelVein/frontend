import { createFileRoute } from "@tanstack/react-router";

import { legacyProjectRedirect } from "@/lib/legacy-project-redirect";

/** Old project links keep working after the /p migration. */
export const Route = createFileRoute("/resource-packs/$slug")({
  beforeLoad: ({ location, params }) =>
    legacyProjectRedirect({
      searchStr: location.searchStr,
      slug: params.slug,
      type: "resourcepack",
    }),
});
