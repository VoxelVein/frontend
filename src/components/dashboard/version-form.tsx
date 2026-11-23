import { useState } from "react";
import type { FormEvent } from "react";
import { toast } from "sonner";
import { safeParse } from "valibot";

import { CheckboxGroup } from "@/components/dashboard/checkbox-group";
import { GameVersionPicker } from "@/components/dashboard/game-version-picker";
import { FormField } from "@/components/form-field";
import { MarkdownEditor } from "@/components/markdown-editor";
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
  MODPACK_PLATFORMS,
  normalizePlatformId,
} from "@/lib/release-platforms";
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

interface ModpackFileDraft {
  customPlatform: string;
  file: File | null;
  key: number;
  platform: string;
}

const updateModpackDraft = (
  drafts: ModpackFileDraft[],
  key: number,
  patch: Partial<ModpackFileDraft>
): ModpackFileDraft[] =>
  drafts.map((draft) => (draft.key === key ? { ...draft, ...patch } : draft));

const collectUploads = (
  isModpack: boolean,
  drafts: ModpackFileDraft[],
  file: File | null
): { file: File; platform: string | null }[] => {
  if (!isModpack) {
    return file ? [{ file, platform: null }] : [];
  }

  return drafts.flatMap((draft) => {
    if (!draft.file) {
      return [];
    }

    const platform =
      draft.platform === "other"
        ? normalizePlatformId(draft.customPlatform)
        : draft.platform;

    return platform ? [{ file: draft.file, platform }] : [];
  });
};

const getModpackFileError = (drafts: ModpackFileDraft[]): string | null => {
  const selectedPlatforms = drafts.flatMap((draft) => {
    if (!draft.file) {
      return [];
    }

    if (draft.platform === "other") {
      const normalized = normalizePlatformId(draft.customPlatform);

      return normalized ? [normalized] : ["invalid-platform"];
    }

    return [draft.platform];
  });

  if (selectedPlatforms.includes("invalid-platform")) {
    return "Enter a valid name for each custom platform.";
  }

  if (new Set(selectedPlatforms).size !== selectedPlatforms.length) {
    return "Choose a different platform for each file.";
  }

  return null;
};

const ModpackFileInputs = ({
  drafts,
  error,
  isStorageAvailable,
  onChange,
}: {
  drafts: ModpackFileDraft[];
  error?: string;
  isStorageAvailable: boolean;
  onChange: (drafts: ModpackFileDraft[]) => void;
}) => {
  const nextPlatform =
    MODPACK_PLATFORMS.find(
      ({ id }) => !drafts.some((draft) => draft.platform === id)
    )?.id ?? "other";

  const addDraft = () =>
    onChange([
      ...drafts,
      {
        customPlatform: "",
        file: null,
        key: Date.now() + drafts.length,
        platform: nextPlatform,
      },
    ]);

  return (
    <fieldset className="grid gap-3">
      <legend className="text-foreground text-sm font-medium">
        Platform downloads
      </legend>
      <p className="text-muted-foreground text-sm">
        Add one compatible archive for each launcher. All files share this
        release version and changelog.
      </p>
      {drafts.map((draft) => {
        const chosen = MODPACK_PLATFORMS.find(
          (platform) => platform.id === draft.platform
        );

        const update = (patch: Partial<ModpackFileDraft>) =>
          onChange(updateModpackDraft(drafts, draft.key, patch));

        const extensions = chosen?.extensions ?? [".mrpack", ".zip"];

        const accept = [
          ...extensions,
          ...extensions.map((extension) => contentTypeFor(extension)),
        ].join(",");

        return (
          <div
            key={draft.key}
            className="border-border grid gap-3 rounded-lg border p-3 sm:grid-cols-[minmax(10rem,0.8fr)_minmax(0,1.2fr)_auto]"
          >
            <div className="grid content-start gap-2">
              <label
                className="text-foreground text-sm font-medium"
                htmlFor={`modpack-platform-${draft.key}`}
              >
                Platform
              </label>
              <Select
                items={[
                  ...MODPACK_PLATFORMS.map(({ id, label }) => ({
                    label,
                    value: id,
                  })),
                  { label: "Other…", value: "other" },
                ]}
                value={draft.platform}
                onValueChange={(value) =>
                  update({ platform: value ?? "modrinth" })
                }
              >
                <SelectTrigger
                  id={`modpack-platform-${draft.key}`}
                  className="min-h-11 w-full"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODPACK_PLATFORMS.map(({ id, label }) => (
                    <SelectItem key={id} value={id}>
                      {label}
                    </SelectItem>
                  ))}
                  <SelectItem value="other">Other…</SelectItem>
                </SelectContent>
              </Select>
              {draft.platform === "other" ? (
                <FormField
                  id={`modpack-custom-platform-${draft.key}`}
                  label="Platform name"
                  value={draft.customPlatform}
                  onChange={(event) =>
                    update({ customPlatform: event.target.value })
                  }
                  placeholder="ATLauncher"
                  autoComplete="off"
                />
              ) : null}
            </div>
            <FormField
              id={`modpack-file-${draft.key}`}
              label="Archive"
              type="file"
              accept={accept}
              onChange={(event) =>
                update({ file: event.target.files?.[0] ?? null })
              }
              disabled={!isStorageAvailable}
              helperText={
                draft.file
                  ? `${draft.file.name} · ${formatBytes(draft.file.size)}`
                  : "A .mrpack or .zip file, up to 100 MB."
              }
              className="file:text-foreground py-2 file:mr-3 file:border-0 file:bg-transparent file:text-sm file:font-medium"
            />
            {drafts.length > 1 ? (
              <Button
                type="button"
                variant="outline"
                className="min-h-11 self-end"
                onClick={() =>
                  onChange(drafts.filter((item) => item.key !== draft.key))
                }
              >
                Remove
              </Button>
            ) : null}
          </div>
        );
      })}
      <Button
        type="button"
        variant="outline"
        className="min-h-11 w-fit"
        onClick={addDraft}
      >
        Add platform file
      </Button>
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
};

// oxlint-disable react-doctor/prefer-useReducer -- Each field is independent form state; reset is the only action that intentionally updates several fields together.
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

  const [modpackFiles, setModpackFiles] = useState<ModpackFileDraft[]>([
    { customPlatform: "", file: null, key: 0, platform: "modrinth" },
  ]);

  const [errors, setErrors] = useState<FieldErrors>(NO_FIELD_ERRORS);
  const { isAvailable: isStorageAvailable } = useStorageAvailable();

  const [progress, setProgress] = useState<number | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);

  const pending = progress !== null;
  const isModpack = projectType === "modpack";
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
    setModpackFiles([
      { customPlatform: "", file: null, key: Date.now(), platform: "modrinth" },
    ]);
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
      projectId,
      versionNumber,
      name: "",
    });

    const fieldErrors = result.success
      ? new Map<string, string>()
      : toFieldErrors(result.issues);

    const uploads = collectUploads(isModpack, modpackFiles, file);

    if (uploads.length === 0) {
      fieldErrors.set("file", `Choose a ${extensionList} file to upload.`);
    }

    if (isModpack) {
      const platformError = getModpackFileError(modpackFiles);

      if (platformError) {
        fieldErrors.set("file", platformError);
      }
    }

    if (hasLoaders(projectType) && loaders.length === 0) {
      fieldErrors.set("loaders", "Choose at least one loader.");
    }

    if (!result.success || fieldErrors.size > 0 || uploads.length === 0) {
      setErrors(fieldErrors);

      return;
    }

    setErrors(NO_FIELD_ERRORS);
    setProgress(0);

    let versionId: string | null = null;

    try {
      ({ id: versionId } = await createVersion({ data: result.output }));

      for (const upload of uploads) {
        // Bound concurrent archive transfers and let all requests settle before
        // the error path removes a newly-created version.
        // oxlint-disable-next-line no-await-in-loop, react-doctor/async-await-in-loop -- Bound simultaneous archive transfers and let every request settle before rolling back the new release.
        await uploadVersionFile({
          file: upload.file,
          onProgress: setProgress,
          platform: upload.platform,
          projectId,
          versionId,
        });
      }

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

      <MarkdownEditor
        id="version-changelog"
        label="Changelog (Markdown)"
        rows={8}
        value={changelog}
        onChange={(event) => setChangelog(event.target.value)}
        error={errors.get("changelog")}
        helperText="Markdown is supported. Shown beside the release on the public page."
        previewEmptyMessage="What changed in this release will appear here."
      />

      {isModpack ? (
        <ModpackFileInputs
          drafts={modpackFiles}
          error={errors.get("file")}
          isStorageAvailable={isStorageAvailable}
          onChange={setModpackFiles}
        />
      ) : (
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
      )}

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

// oxlint-enable react-doctor/prefer-useReducer
