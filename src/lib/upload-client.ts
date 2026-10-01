import type { ProjectImageKind } from "@/db/schema";
import { resizeImageForUpload } from "@/lib/image-resize";
import type { ProjectFileView } from "@/lib/projects";
import { contentTypeFor } from "@/lib/upload-validation";

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

export interface UploadedProjectImage {
  contentType: string;
  height: number;
  id: string;
  kind: ProjectImageKind;
  size: number;
  url: string;
  width: number;
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

/** Same contract as `readError`, for routes that answer with fetch. */
const readErrorLike = async (response: Response): Promise<string> => {
  try {
    // SAFETY: the delete route always answers errors with { error: string }.
    const body = (await response.json()) as { error?: string };
    return body.error || `The request failed (${response.status}).`;
  } catch {
    return `The request failed (${response.status}).`;
  }
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
  const uploadName = toUploadFilename(file.name);
  const filename = encodeURIComponent(uploadName);
  const url = `/api/projects/${projectId}/versions/${versionId}/files?filename=${filename}`;

  // oxlint-disable-next-line promise/avoid-new -- XMLHttpRequest has no promise API.
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", url);
    request.setRequestHeader("content-type", contentTypeFor(uploadName));
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

/**
 * Uploads a project icon or gallery image. Uses XMLHttpRequest for the same
 * reason as version files: fetch does not report upload progress.
 */
export const uploadProjectImage = async ({
  file,
  kind,
  onProgress,
  projectId,
}: {
  file: File;
  kind: ProjectImageKind;
  onProgress?: (fraction: number) => void;
  projectId: string;
}): Promise<UploadedProjectImage> => {
  const url = `/api/projects/${projectId}/images?kind=${kind}`;

  // Resized here rather than in the call site, so every upload path gets it
  // and none can forget. The un-resized original never leaves the device,
  // which is the point: it cannot be deleting bytes from the bucket later.
  const payload = await resizeImageForUpload(file, kind);

  // oxlint-disable-next-line promise/avoid-new -- XMLHttpRequest has no promise API.
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", url);
    request.setRequestHeader("content-type", payload.type);
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        onProgress?.(event.loaded / event.total);
      }
    });
    request.addEventListener("load", () => {
      if (request.status === 201) {
        // SAFETY: a 201 from the image route always carries an image record.
        resolve(JSON.parse(request.responseText) as UploadedProjectImage);
        return;
      }
      reject(new Error(readError(request)));
    });
    request.addEventListener("error", () =>
      reject(new Error("The upload failed. Check your connection."))
    );
    request.send(payload);
  });
};

/** Deletes one of a project's images. */
export const deleteProjectImage = async (
  projectId: string,
  imageId: string
): Promise<void> => {
  const response = await fetch(`/api/projects/${projectId}/images/${imageId}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error(await readErrorLike(response));
  }
};
