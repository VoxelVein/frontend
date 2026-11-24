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

const ShadersPage = () => {
  const data = useLoaderData({ from: "/shaders/" });

  return <ProjectBrowser type="shader" {...data} />;
};
>>>>>>> Stashed changes

/** Old /shaders bookmarks resolve to the project route below /p. */
export const Route = createFileRoute("/shaders/")({
  beforeLoad: ({ location }) =>
    legacyProjectRedirect({ searchStr: location.searchStr, type: "shader" }),
});
