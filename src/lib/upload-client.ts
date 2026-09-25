import type { ProjectFileView } from "@/lib/projects";

const UNSAFE_FILENAME_CHARACTERS = /[^A-Za-z0-9._+-]+/gu;
const LEADING_SEPARATORS = /^[._+-]+/u;

/** Maps a local filename onto the characters the server accepts. */
export const toUploadFilename = (name: string): string =>
  name
    .replaceAll(UNSAFE_FILENAME_CHARACTERS, "-")
    .replaceAll("..", ".")
    .replace(LEADING_SEPARATORS, "");

interface UploadOptions {
  file: File;
  onProgress?: (fraction: number) => void;
  projectId: string;
  versionId: string;
}

const readError = (request: XMLHttpRequest): string => {
  try {
    // SAFETY: the upload route always answers errors with { error: string }.
    const body = JSON.parse(request.responseText) as { error?: string };
    if (body.error) {
      return body.error;
    }
  } catch {
    // Fall through to the generic message below.
  }
  return `The upload failed (${request.status}).`;
};

/**
 * Uploads one file to a version. Uses XMLHttpRequest because fetch does not
 * report upload progress.
 */
export const uploadVersionFile = ({
  file,
  onProgress,
  projectId,
  versionId,
}: UploadOptions): Promise<ProjectFileView> => {
  const filename = encodeURIComponent(toUploadFilename(file.name));
  const url = `/api/projects/${projectId}/versions/${versionId}/files?filename=${filename}`;

  // oxlint-disable-next-line promise/avoid-new -- XMLHttpRequest has no promise API.
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", url);
    request.setRequestHeader("content-type", "application/java-archive");
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        onProgress?.(event.loaded / event.total);
      }
    });
    request.addEventListener("load", () => {
      if (request.status === 201) {
        // SAFETY: a 201 from the upload route always carries a ProjectFileView.
        resolve(JSON.parse(request.responseText) as ProjectFileView);
        return;
      }
      reject(new Error(readError(request)));
    });
    request.addEventListener("error", () =>
      reject(new Error("The upload failed. Check your connection."))
    );
    request.send(file);
  });
};
