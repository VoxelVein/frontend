import { useState } from "react";
import type { FormEvent } from "react";
import { safeParse } from "valibot";

import { CheckboxGroup } from "@/components/dashboard/checkbox-group";
import { FormField } from "@/components/form-field";
import { FormTextarea } from "@/components/form-textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  errorMessage,
  NO_FIELD_ERRORS,
  toFieldErrors,
} from "@/lib/form-errors";
import type { FieldErrors } from "@/lib/form-errors";
import { formatBytes } from "@/lib/format";
import { formatMinecraftVersion } from "@/lib/minecraft-versions";
import {
  GAME_VERSIONS,
  LOADERS_BY_TYPE,
  RELEASE_CHANNELS,
  versionInputSchema,
} from "@/lib/projects";
import type { ProjectType, ReleaseChannel } from "@/lib/projects";
import { createVersion, deleteVersion } from "@/lib/projects.functions";
import { uploadVersionFile } from "@/lib/upload-client";

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
  const [formError, setFormError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);

  const loaderLegend = projectType === "mod" ? "Loaders" : "Platforms";
  const pending = progress !== null;

  const reset = () => {
    setVersionNumber("");
    setChangelog("");
    setFile(null);
    setFileInputKey((key) => key + 1);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

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
      fieldErrors.set("file", "Choose a .jar file to upload.");
    }
    if (!result.success || !file) {
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
      setFormError(errorMessage(error, "Could not create the version."));
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

      <CheckboxGroup
        id="version-game-versions"
        legend="Game versions"
        options={GAME_VERSIONS}
        values={gameVersions}
        onChange={setGameVersions}
        formatLabel={formatMinecraftVersion}
        error={errors.get("gameVersions")}
      />

      <CheckboxGroup
        id="version-loaders"
        legend={loaderLegend}
        options={LOADERS_BY_TYPE[projectType]}
        values={loaders}
        onChange={setLoaders}
        formatLabel={capitalize}
        error={errors.get("loaders")}
      />

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
        accept=".jar,application/java-archive"
        onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        error={errors.get("file")}
        helperText={
          file
            ? `${file.name} · ${formatBytes(file.size)}`
            : "A .jar file, up to 100 MB."
        }
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

      {formError ? (
        <p role="alert" className="text-destructive text-sm">
          {formError}
        </p>
      ) : null}

      <div>
        <Button type="submit" className="min-h-11" disabled={pending}>
          {pending ? "Uploading…" : "Create version"}
        </Button>
      </div>
    </form>
  );
};
