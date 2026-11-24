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

const ModpacksPage = () => {
  const data = useLoaderData({ from: "/modpacks/" });

  return <ProjectBrowser type="modpack" {...data} />;
};
>>>>>>> Stashed changes

/** Old /modpacks bookmarks resolve to the project route below /p. */
export const Route = createFileRoute("/modpacks/")({
  beforeLoad: ({ location }) =>
    legacyProjectRedirect({ searchStr: location.searchStr, type: "modpack" }),
});
