import { createFileRoute } from "@tanstack/react-router";

<<<<<<< Updated upstream
import { legacyProjectRedirect } from "@/lib/legacy-project-redirect";
=======
import {
  ProjectBrowser,
  ProjectBrowserSkeleton,
} from "@/components/projects/project-browser";
import { loadProjectBrowser } from "@/lib/project-browser-loader";
import { SITE_DESCRIPTION, socialMeta } from "@/lib/site";

const ModsPage = () => {
  const data = useLoaderData({ from: "/mods/" });

  return <ProjectBrowser type="mod" {...data} />;
};
>>>>>>> Stashed changes

/** Old /mods bookmarks resolve to the project route below /p. */
export const Route = createFileRoute("/mods/")({
  beforeLoad: ({ location }) =>
    legacyProjectRedirect({ searchStr: location.searchStr, type: "mod" }),
});
