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

const ResourcePacksPage = () => {
  const data = useLoaderData({ from: "/resource-packs/" });

  return <ProjectBrowser type="resourcepack" {...data} />;
};
>>>>>>> Stashed changes

/** Old /resource-packs bookmarks resolve to the project route below /p. */
export const Route = createFileRoute("/resource-packs/")({
  beforeLoad: ({ location }) =>
    legacyProjectRedirect({
      searchStr: location.searchStr,
      type: "resourcepack",
    }),
});
