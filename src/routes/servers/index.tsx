import { createFileRoute } from "@tanstack/react-router";

<<<<<<< Updated upstream
import { legacyProjectRedirect } from "@/lib/legacy-project-redirect";
=======
import {
  ProjectBrowser,
  ProjectBrowserSkeleton,
} from "@/components/projects/project-browser";
import { VotingLeaderboard } from "@/components/projects/voting-leaderboard";
import { loadProjectBrowser } from "@/lib/project-browser-loader";
import { SITE_DESCRIPTION, socialMeta } from "@/lib/site";

const ServersPage = () => {
  const data = useLoaderData({ from: "/servers/" });

  return (
    <>
      <ProjectBrowser type="server" {...data} />
      <VotingLeaderboard />
    </>
  );
};
>>>>>>> Stashed changes

/** Old /servers bookmarks resolve to the project route below /p. */
export const Route = createFileRoute("/servers/")({
  beforeLoad: ({ location }) =>
    legacyProjectRedirect({ searchStr: location.searchStr, type: "server" }),
});
