import { IconPlus, IconX } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { KeyboardEvent } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { getSuggestedMinecraftVersions } from "@/lib/minecraft-versions.functions";

interface SuggestedVersionsModalProps {
  /** Versions the server already supports, kept unless the creator removes them. */
  initialValues: readonly string[];
  /** Receives the whole chip list when the creator accepts it. */
  onAccept: (versions: string[]) => void;
  /** Closes the editor with no changes applied. */
  onCancel: () => void;
}

/** Stable, duplicate-free chip order: what was already there first. */
const mergeVersions = (
  initialValues: readonly string[],
  suggestions: readonly string[],
  customVersions: readonly string[],
  removed: readonly string[]
): string[] => {
  const removedSet = new Set(removed);

  return [
    ...new Set([...initialValues, ...suggestions, ...customVersions]),
  ].filter((version) => !removedSet.has(version));
};

/**
 * A tag editor for a server's supported Minecraft versions.
 *
 * Mojang's release list is fetched when the dialog opens and appears as
 * removable chips alongside the versions already saved on the server. Anything
 * typed into the field becomes a chip on Enter or comma. Removals and additions
 * are tracked separately from the query result, so a refetch cannot undo what
 * the creator has done.
 */
export const SuggestedVersionsModal = ({
  initialValues,
  onAccept,
  onCancel,
}: SuggestedVersionsModalProps) => {
  const [customVersions, setCustomVersions] = useState<string[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const { data, isPending, isError } = useQuery({
    queryFn: () => getSuggestedMinecraftVersions(),
    queryKey: ["suggested-minecraft-versions"],
    retry: false,
    staleTime: 60 * 60 * 1000,
  });

  const versions = mergeVersions(
    initialValues,
    data ?? [],
    customVersions,
    removed
  );

  const commitDraft = () => {
    const value = draft.trim();

    if (!value) {
      return;
    }

    setCustomVersions((current) =>
      current.includes(value) ? current : [...current, value]
    );
    setRemoved((current) => current.filter((entry) => entry !== value));
    setDraft("");
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    // An IME uses Enter to confirm a candidate; committing then would cut a
    // Japanese or Chinese version name in half.
    if (event.nativeEvent.isComposing) {
      return;
    }

    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      commitDraft();

      return;
    }

    if (
      event.key === "Backspace" &&
      draft.length === 0 &&
      versions.length > 0
    ) {
      event.preventDefault();

      const last = versions.at(-1);

      if (!last) {
        return;
      }

      // Putting the value back in the field is the edit affordance: a chip is
      // removed from the list and its text becomes editable again. Pressing
      // Enter re-commits it, this time as a custom entry.
      setDraft(last);
      setCustomVersions((current) => current.filter((entry) => entry !== last));
      setRemoved((current) =>
        current.includes(last) ? current : [...current, last]
      );
    }
  };

  const remove = (version: string) => {
    setRemoved((current) =>
      current.includes(version) ? current : [...current, version]
    );
  };

  return (
    <>
      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setConfirmDiscard(true);
          }
        }}
        open
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Suggested Minecraft versions</DialogTitle>
            <DialogDescription>
              Releases suggested by Mojang are added as chips. Remove the ones
              this server does not support, or type a version of your own.
            </DialogDescription>
          </DialogHeader>

          {isError ? (
            <output className="text-muted-foreground block text-sm">
              Suggestions could not be loaded. You can still add versions by
              hand.
            </output>
          ) : null}

          {isPending ? (
            <p className="text-muted-foreground flex items-center gap-2 text-sm">
              <Spinner label="Loading suggested versions" />
              Loading suggested versions…
            </p>
          ) : null}

          <div className="grid gap-2">
            <label
              className="text-foreground text-sm font-medium"
              htmlFor="suggested-versions-input"
            >
              Supported versions
            </label>
            <div className="border-border bg-background flex min-h-11 flex-wrap items-center gap-2 rounded-lg border p-2">
              {versions.map((version) => (
                <span
                  key={version}
                  className="bg-muted text-foreground inline-flex min-h-8 items-center gap-1 rounded-md border px-2 text-sm font-medium"
                >
                  {version}
                  <Button
                    aria-label={`Remove ${version}`}
                    onClick={() => remove(version)}
                    size="icon-xs"
                    type="button"
                    variant="ghost"
                  >
                    <IconX aria-hidden="true" size={14} />
                  </Button>
                </span>
              ))}
              <input
                aria-describedby="suggested-versions-help"
                className="text-foreground placeholder:text-muted-foreground min-w-32 flex-1 bg-transparent text-sm outline-none"
                id="suggested-versions-input"
                onBlur={commitDraft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  versions.length > 0 ? "Add another…" : "Type a version…"
                }
                value={draft}
              />
            </div>
            <p
              className="text-muted-foreground text-xs"
              id="suggested-versions-help"
            >
              Press Enter or comma to add a version, or Backspace on an empty
              field to edit the last one. The × button on a chip removes it.
            </p>
          </div>

          <DialogFooter className="gap-2">
            <Button
              onClick={() => setConfirmDiscard(true)}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button onClick={() => onAccept(versions)} type="button">
              <IconPlus aria-hidden="true" size={16} />
              Accept
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        confirmLabel="Discard changes"
        description="Any versions you added or removed here will be lost."
        onConfirm={() => {
          setConfirmDiscard(false);
          onCancel();
        }}
        onOpenChange={setConfirmDiscard}
        open={confirmDiscard}
        title="Discard changes?"
        variant="destructive"
      />
    </>
  );
};
