import { useState } from "react";
import type { FormEvent } from "react";
import { toast } from "sonner";
import { safeParse } from "valibot";

import { CheckboxGroup } from "@/components/dashboard/checkbox-group";
import { GameVersionPicker } from "@/components/dashboard/game-version-picker";
import { FormField } from "@/components/form-field";
import { FormTextarea } from "@/components/form-textarea";
import { StorageGated } from "@/components/storage-gated";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useStorageAvailable } from "@/hooks/use-storage-available";
import {
  errorMessage,
  NO_FIELD_ERRORS,
  toFieldErrors,
} from "@/lib/form-errors";
import type { FieldErrors } from "@/lib/form-errors";
import { formatBytes } from "@/lib/format";
import {
  hasLoaders,
  LOADER_LABELS,
  LOADERS_BY_TYPE,
  RELEASE_CHANNELS,
  versionInputSchema,
} from "@/lib/projects";
import type { ProjectType, ReleaseChannel } from "@/lib/projects";
import { createVersion, deleteVersion } from "@/lib/projects.functions";
import {
  STORAGE_UNAVAILABLE_REASON,
  storageUnavailableNote,
} from "@/lib/storage-availability";
import { uploadVersionFile } from "@/lib/upload-client";
import {
  ALLOWED_EXTENSIONS_BY_TYPE,
  contentTypeFor,
} from "@/lib/upload-validation";

interface VersionFormProps {
  onCreated: () => Promise<void> | void;
  projectId: string;
  projectType: ProjectType;
}

const capitalize = (value: string) =>
  value.charAt(0).toUpperCase() + value.slice(1);

const isReleaseChannel = (value: string | null): value is ReleaseChannel =>
  RELEASE_CHANNELS.some((channel) => channel === value);

export const VersionForm = ({
  onCreated,
  projectId,
  projectType,
}: VersionFormProps) => {
  const [versionNumber, setVersionNumber] = useState("");
  const [channel, setChannel] = useState<ReleaseChannel>("release");
  const [gameVersions, setGameVersions] = useState<string[]>([]);
  const [loaders, setLoaders] = useState<string[]>([]);
  const [changelog, setChangelog] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<FieldErrors>(NO_FIELD_ERRORS);
  const { isAvailable: isStorageAvailable } = useStorageAvailable();

  const [progress, setProgress] = useState<number | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);

  const pending = progress !== null;
  const extensions = ALLOWED_EXTENSIONS_BY_TYPE[projectType];
  const extensionList = extensions.join(" or ");
  const accept = [
    ...extensions,
    ...new Set(extensions.map((extension) => contentTypeFor(extension))),
  ].join(",");

  // Three states, not a nested ternary: unavailable outranks the chosen file,
  // because a reader who cannot upload needs the reason rather than the name of
  // a file they will never be able to send.
  let fileHelper = `A ${extensionList} file, up to 100 MB.`;
  if (file) {
    fileHelper = `${file.name} · ${formatBytes(file.size)}`;
  }
  if (!isStorageAvailable) {
    fileHelper = storageUnavailableNote("Creating a version");
  }

  const reset = () => {
    setVersionNumber("");
    setChangelog("");
    setFile(null);
    setFileInputKey((key) => key + 1);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    toast.dismiss();

    const result = safeParse(versionInputSchema, {
      changelog,
      channel,
      gameVersions,
      loaders,
      name: "",
      projectId,
      versionNumber,
    });
    const fieldErrors = result.success
      ? new Map<string, string>()
      : toFieldErrors(result.issues);
    if (!file) {
      fieldErrors.set("file", `Choose a ${extensionList} file to upload.`);
    }
    if (hasLoaders(projectType) && loaders.length === 0) {
      fieldErrors.set("loaders", "Choose at least one loader.");
    }
    if (!result.success || fieldErrors.size > 0 || !file) {
      setErrors(fieldErrors);
      return;
    }
    setErrors(NO_FIELD_ERRORS);
    setProgress(0);

    let versionId: string | null = null;
    try {
      ({ id: versionId } = await createVersion({ data: result.output }));
      await uploadVersionFile({
        file,
        onProgress: setProgress,
        projectId,
        versionId,
      });
      reset();
      await onCreated();
    } catch (error) {
      // Don't leave a version without a file behind.
      if (versionId) {
        await deleteVersion({ data: { versionId } }).catch(() => null);
      }
      toast.error(errorMessage(error, "Could not create the version."));
    }
    setProgress(null);
  };

  return (
    <form noValidate onSubmit={handleSubmit} className="grid gap-6">
      <div className="grid gap-6 sm:grid-cols-2">
        <FormField
          id="version-number"
          label="Version number"
          value={versionNumber}
          onChange={(event) => setVersionNumber(event.target.value)}
          error={errors.get("versionNumber")}
          placeholder="1.0.0"
          autoComplete="off"
          spellCheck={false}
          required
        />

        <div className="grid content-start gap-2">
          <label
            htmlFor="version-channel"
            className="text-foreground text-sm font-medium"
          >
            Release channel
          </label>
          <Select
            items={RELEASE_CHANNELS.map((value) => ({
              label: capitalize(value),
              value,
            }))}
            value={channel}
            onValueChange={(value) => {
              if (isReleaseChannel(value)) {
                setChannel(value);
              }
            }}
          >
            <SelectTrigger id="version-channel" className="min-h-11 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RELEASE_CHANNELS.map((value) => (
                <SelectItem key={value} value={value}>
                  {capitalize(value)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <GameVersionPicker
        id="version-game-versions"
        values={gameVersions}
        onChange={setGameVersions}
        error={errors.get("gameVersions")}
      />

      {hasLoaders(projectType) ? (
        <CheckboxGroup
          id="version-loaders"
          legend={LOADER_LABELS[projectType].plural}
          options={LOADERS_BY_TYPE[projectType]}
          values={loaders}
          onChange={setLoaders}
          formatLabel={capitalize}
          error={errors.get("loaders")}
        />
      ) : null}

      <FormTextarea
        id="version-changelog"
        label="Changelog (Markdown)"
        rows={5}
        value={changelog}
        onChange={(event) => setChangelog(event.target.value)}
        error={errors.get("changelog")}
        className="font-mono text-xs"
      />

      <FormField
        key={fileInputKey}
        id="version-file"
        label="File"
        type="file"
        accept={accept}
        onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        error={errors.get("file")}
        disabled={!isStorageAvailable}
        helperText={fileHelper}
        className="file:text-foreground py-2 file:mr-3 file:border-0 file:bg-transparent file:text-sm file:font-medium"
        required
      />

      {progress === null ? null : (
        <div className="grid gap-2">
          <label
            htmlFor="version-upload-progress"
            className="text-foreground text-sm font-medium"
          >
            Uploading
          </label>
          <progress
            id="version-upload-progress"
            value={Math.round(progress * 100)}
            max={100}
            className="bg-muted [&::-moz-progress-bar]:bg-primary [&::-webkit-progress-bar]:bg-muted [&::-webkit-progress-value]:bg-primary h-2 w-full overflow-hidden rounded-full"
          >
            {Math.round(progress * 100)}%
          </progress>
        </div>
      )}

      <div className="grid gap-2">
        {/* Creating a version is an upload, so it needs the file server. Gated
            on its own rather than only on the field above: the button is what
            people reach for, and a dimmed one that still submits is worse than
            an honest one. */}
        <StorageGated reason={STORAGE_UNAVAILABLE_REASON}>
          {({ isAvailable }) => (
            <Button
              type="submit"
              className="min-h-11"
              disabled={pending || !isAvailable}
            >
              {pending ? "Uploading…" : "Create version"}
            </Button>
          )}
        </StorageGated>
      </div>
    </form>
  );
};
