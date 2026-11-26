import { IconExternalLink } from "@tabler/icons-react";
import { useState } from "react";
import { toast } from "sonner";

import { ProjectLink } from "@/components/projects/project-link";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { Spinner } from "@/components/ui/spinner";
import { errorMessage } from "@/lib/form-errors";
import type { PublicationOutcome } from "@/lib/project-moderation";
import {
  submitProjectForReview,
  unpublishProject,
  withdrawProjectReview,
} from "@/lib/project-moderation.functions";
import { hasVersions } from "@/lib/projects";
import type { ProjectView } from "@/lib/projects";
import { cn } from "@/lib/utils";

/**
 * Per-status copy and the one action available from it.
 *
 * `action` is null where there is nothing to do, which is how a removed project
 * renders read-only instead of showing a button the server would reject. The
 * page header carries the status badge, so this panel names its own job
 * ("Visibility") rather than repeating the status word.
 */
const VISIBILITY = {
  draft: {
    action: "Publish",
    description:
      "Only you and admins can see this project. One you have published before goes live straight away; anything else waits for an admin.",
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
/**
 * Discriminated rather than one shape with an optional field, because the
 * publish transition reports *which* of two different things happened and the
 * others report nothing at all  -  and a `run` typed as "maybe a value" would push
 * that uncertainty onto every caller.
 */
type Transition =
  | {
      kind: "plain";
      run: () => Promise<void>;
      success: string;
    }
  | {
      kind: "publish";
      run: () => Promise<PublicationOutcome>;
      success: string;
      /** Said when the project went straight back up rather than into the queue. */
      successWhenPublished: string;
    };

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
              kind: "publish",
              run: () =>
                submitProjectForReview({ data: { projectId: project.id } }),
              success: "Submitted for review",
              // Said rather than "submitted", because telling someone to wait
              // for a review that did not happen is worse than saying nothing.
              successWhenPublished: "Published",
            }
          : null;
      }

      case "pending": {
        return {
          kind: "plain",
          run: () => withdrawProjectReview({ data: { projectId: project.id } }),
          success: "Moved back to drafts",
        };
      }

      case "published": {
        return {
          kind: "plain",
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
    setIsPending(true);

    try {
      let message = action.success;

      if (action.kind === "publish") {
        message =
          (await action.run()) === "published"
            ? action.successWhenPublished
            : action.success;
      } else {
        await action.run();
      }

      await onChange();
      toast.success(message);
    } catch (actionError) {
      toast.error(errorMessage(actionError, "Could not change visibility."));
    }

    setIsPending(false);
  };

  return (
    <section
      aria-busy={isPending}
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
        {isPending ? <Spinner label="Changing visibility" /> : null}
      </div>
    </section>
  );
};
