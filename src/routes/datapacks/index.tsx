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

const DatapacksPage = () => {
  const data = useLoaderData({ from: "/datapacks/" });

  return <ProjectBrowser type="datapack" {...data} />;
};
>>>>>>> Stashed changes

/** Old /datapacks bookmarks resolve to the project route below /p. */
export const Route = createFileRoute("/datapacks/")({
  beforeLoad: ({ location }) =>
    legacyProjectRedirect({ searchStr: location.searchStr, type: "datapack" }),
});
