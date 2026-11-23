import { createFileRoute } from "@tanstack/react-router";

import { legacyProjectRedirect } from "@/lib/legacy-project-redirect";

/** Old gallery links keep working after the /p migration. */
export const Route = createFileRoute("/plugins/$slug/gallery")({
  beforeLoad: ({ location, params }) =>
    legacyProjectRedirect({
      gallery: true,
      searchStr: location.searchStr,
      slug: params.slug,
      type: "plugin",
    }),
});
