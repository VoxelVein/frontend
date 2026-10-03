import { IconLock } from "@tabler/icons-react";

import type { DeletionContext } from "@/components/settings/danger/deletion-flow";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import {
  PROTECTED_PROJECT_LABEL,
  PROTECTED_PROJECT_LABEL_PLURAL,
} from "@/lib/projects";

interface ConsequencesStepProps {
  context: DeletionContext;
  keepProjectIds: string[];
  onCancel: () => void;
  onContinue: () => void;
  onToggleKeep: (projectId: string, keep: boolean) => void;
}

/**
 * Step 1: what deleting the account actually does, and a per-project choice.
 *
 * The project list is the part that needs reading carefully, so each project
 * is a fieldset with its own radio group and a legend, rather than a flat
 * list of controls. Projects an admin marked large cannot be chosen away.
 */
export const ConsequencesStep = ({
  context,
  keepProjectIds,
  onCancel,
  onContinue,
  onToggleKeep,
}: ConsequencesStepProps) => {
  const hasProtected = context.projects.some((project) => project.isProtected);
  const keptIds = new Set(keepProjectIds);

  return (
    <div className="grid gap-4">
      {context.mode === "immediate" ? (
        <p className="text-foreground text-sm">
          Your account, profile, and sign-in methods are deleted immediately and
          permanently. This cannot be undone.
        </p>
      ) : (
        <div className="grid gap-2 text-sm">
          <p className="text-foreground">
            Your account is deactivated right away and you are signed out
            everywhere. It is permanently deleted after 14 days.
          </p>
          <p className="text-muted-foreground">
            Until then, it can only be restored by contacting VoxelVein support.
          </p>
        </div>
      )}

      {context.projects.length > 0 ? (
        <div className="grid gap-3">
          <p className="text-foreground text-sm font-medium">
            Choose what happens to each of your projects.
          </p>
          <ul className="grid gap-3">
            {context.projects.map((project) => {
              const keep = keptIds.has(project.id);

              if (project.isProtected) {
                return (
                  <li
                    key={project.id}
                    className="border-border bg-muted/40 flex items-start gap-3 rounded-lg border p-3"
                  >
                    <IconLock
                      aria-hidden
                      size={18}
                      className="text-muted-foreground mt-0.5 shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-foreground text-sm font-medium">
                        {project.name}
                      </p>
                      <p className="text-muted-foreground text-sm">
                        Kept. The VoxelVein team has marked it as a{" "}
                        {PROTECTED_PROJECT_LABEL.toLowerCase()}, so it stays
                        published without an owner.
                      </p>
                    </div>
                  </li>
                );
              }

              return (
                <li key={project.id}>
                  <fieldset className="border-border grid gap-2 rounded-lg border p-3">
                    <legend className="text-foreground px-1 text-sm font-medium">
                      {project.name}
                    </legend>
                    <label className="hover:bg-muted/50 flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-2 text-sm transition-colors">
                      <input
                        type="radio"
                        name={`project-${project.id}`}
                        value="delete"
                        checked={!keep}
                        onChange={() => onToggleKeep(project.id, false)}
                        className="accent-primary size-4"
                      />
                      Delete with my account
                    </label>
                    <label className="hover:bg-muted/50 flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-2 text-sm transition-colors">
                      <input
                        type="radio"
                        name={`project-${project.id}`}
                        value="keep"
                        checked={keep}
                        onChange={() => onToggleKeep(project.id, true)}
                        className="accent-primary size-4"
                      />
                      Keep (published without an owner)
                    </label>
                  </fieldset>
                </li>
              );
            })}
          </ul>
          {hasProtected ? (
            <p className="text-muted-foreground text-sm">
              {`${PROTECTED_PROJECT_LABEL_PLURAL} are always kept, and the VoxelVein team is notified so they can look after them.`}
            </p>
          ) : null}
        </div>
      ) : null}

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button
          type="button"
          variant="default"
          className="min-h-11"
          onClick={onContinue}
        >
          Continue
        </Button>
      </DialogFooter>
    </div>
  );
};
