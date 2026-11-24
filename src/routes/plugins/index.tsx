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

const PluginsPage = () => {
  const data = useLoaderData({ from: "/plugins/" });

  return <ProjectBrowser type="plugin" {...data} />;
};
>>>>>>> Stashed changes

/** Old /plugins bookmarks resolve to the project route below /p. */
export const Route = createFileRoute("/plugins/")({
  beforeLoad: ({ location }) =>
    legacyProjectRedirect({ searchStr: location.searchStr, type: "plugin" }),
});
