import { IconExternalLink } from "@tabler/icons-react";
import { useState } from "react";
import { toast } from "sonner";

import { ProjectLink } from "@/components/projects/project-link";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { errorMessage } from "@/lib/form-errors";
import {
  submitProjectForReview,
  unpublishProject,
  withdrawProjectReview,
} from "@/lib/project-moderation.functions";
import { hasVersions } from "@/lib/projects";
import type { ProjectView } from "@/lib/projects";
import { cn } from "@/lib/utils";

/**
 * What each status means for a creator, and the one action it offers.
 *
 * `action` is null where there is nothing to do, which is how a removed project
 * renders read-only instead of showing a button the server would reject.
 */
/**
 * Per-status copy and the action available from it.
 *
 * There is no `heading` here: the page header already carries the status as a
 * badge, and repeating it as this panel's title said the same word twice
 * within a few hundred pixels. The panel names its own job instead.
 */
const VISIBILITY = {
  draft: {
    action: "Submit for review",
    description: "Only you and admins can see this project.",
  },
  pending: {
    action: "Withdraw request",
    description:
      "An admin is reviewing this. It stays hidden from the site until they approve it.",
  },
  published: {
    action: "Unpublish",
    description: "Everyone can find and download this project.",
  },
  removed: {
    action: null,
    description: "This project was removed and is no longer listed.",
  },
} as const;

const RejectionNotice = ({ reason }: { reason: string }) => (
  <div
    aria-live="polite"
    className="border-border bg-muted/50 mt-4 rounded-lg border p-4"
  >
    <h3 className="text-foreground text-sm font-semibold">
      An admin asked for changes
    </h3>
    <p className="text-muted-foreground mt-1 text-sm">{reason}</p>
    <p className="text-muted-foreground mt-2 text-sm">
      Fix what was raised, then submit it for review again.
    </p>
  </div>
);

/**
 * The visibility panel on a creator's project page.
 *
 * Publishing is deliberately not a toggle. A creator submits for review, the
 * project waits in the admin queue as `pending`, and only an approval makes it
 * public, so this panel can offer exactly one transition per status and never
 * implies the creator controls public visibility themselves.
 */
/**
 * The one action a status offers.
 *
 * Named rather than inferred so the click handler never passes an `unknown`
 * around, and so the button label and the call it makes are declared together.
 */
interface Transition {
  run: () => Promise<void>;
  success: string;
}

const missingForReview = (isServer: boolean) =>
  isServer
    ? " Add the server address before submitting it."
    : " Upload a version with a file before submitting it.";

export const PublishPanel = ({
  onChange,
  project,
}: {
  onChange: () => Promise<void>;
  project: ProjectView;
}) => {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isServer = !hasVersions(project.type);
  // Servers are listings: saved join details stand in for an uploaded file.
  const isReady = isServer
    ? project.server !== null
    : project.versions.some((version) => version.files.length);
  const visibility = VISIBILITY[project.status];

  // The one transition this status allows, or null when there is none. Held as
  // data rather than branching inside the click handler so the button, its
  // label and the call it makes cannot drift apart.
  const transition: Transition | null = (() => {
    switch (project.status) {
      case "draft": {
        // Nothing to publish without a file, so no transition is offered.
        return isReady
          ? {
              run: () =>
                submitProjectForReview({ data: { projectId: project.id } }),
              success: "Submitted for review",
            }
          : null;
      }
      case "pending": {
        return {
          run: () => withdrawProjectReview({ data: { projectId: project.id } }),
          success: "Moved back to drafts",
        };
      }
      case "published": {
        return {
          run: () => unpublishProject({ data: { projectId: project.id } }),
          success: "Moved back to drafts",
        };
      }
      case "removed": {
        return null;
      }
      default: {
        return null;
      }
    }
  })();

  const run = async (action: Transition) => {
    setError(null);
    setIsPending(true);
    try {
      await action.run();
      await onChange();
      toast.success(action.success);
    } catch (actionError) {
      setError(errorMessage(actionError, "Could not change visibility."));
    }
    setIsPending(false);
  };

  return (
    <section
      aria-labelledby="visibility-heading"
      className="border-border bg-card rounded-xl border p-6"
    >
      <h2
        id="visibility-heading"
        className="text-foreground text-lg font-semibold"
      >
        Visibility
      </h2>
      <p className="text-muted-foreground mt-1 text-sm">
        {visibility.description}
        {project.status === "draft" && !isReady
          ? missingForReview(isServer)
          : null}
      </p>
      {error ? (
        <p role="alert" className="text-destructive mt-3 text-sm">
          {error}
        </p>
      ) : null}
      {project.status === "draft" && project.rejectionReason ? (
        <RejectionNotice reason={project.rejectionReason} />
      ) : null}
      <div className="mt-4 flex flex-wrap gap-3">
        {transition ? (
          <Button
            type="button"
            variant={project.status === "published" ? "outline" : "default"}
            className="min-h-11"
            disabled={isPending}
            onClick={() => {
              run(transition);
            }}
          >
            {visibility.action}
          </Button>
        ) : null}
        <ProjectLink
          type={project.type}
          slug={project.slug}
          className={cn(buttonVariants({ variant: "ghost" }), "min-h-11")}
        >
          <IconExternalLink size={16} aria-hidden="true" />
          View page
        </ProjectLink>
      </div>
    </section>
  );
};
