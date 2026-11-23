import { resizeImageForUpload } from "@/lib/image-resize";
import type { ProjectImageKind, ProjectFileView } from "@/lib/projects";
import { StorageRequestError } from "@/lib/storage-availability";
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
  platform?: string | null;
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

/** Header every upload sets. The server re-sniffs the bytes regardless. */
const CONTENT_TYPE_HEADER = "content-type";

/** Shared by all three uploads, since they fail the same way. */
const UPLOAD_FAILED_MESSAGE = "The upload failed. Check your connection.";

/**
 * Any 2xx is a success.
 *
 * The routes answer `201`, but a proxy or a runtime that rewrites a response
 * can hand the client a `200` with the same body. Treating only `201` as
 * success turned that into "The upload failed (200)."  -  a failure report for
 * an upload that had actually worked.
 */
const isSuccess = (status: number): boolean => status >= 200 && status < 300;

const toFailure = (body: { code?: string; error?: string }): Error => {
  if (body.code) {
    return new StorageRequestError(
      body.code,
      body.error ?? UPLOAD_FAILED_MESSAGE
    );
  }

  // The status is already in the response, not in the sentence: a reader who
  // sees "The upload failed (200)." cannot tell what to do with the number.
  return new Error(body.error ?? UPLOAD_FAILED_MESSAGE);
};

const readError = (request: XMLHttpRequest): Error => {
  try {
    // SAFETY: the upload routes always answer errors with { error } and,
    // for a storage failure, the `code` alongside it.
    return toFailure(
      JSON.parse(request.responseText) as { code?: string; error?: string }
    );
  } catch {
    return new Error(UPLOAD_FAILED_MESSAGE);
  }
};

/** Same contract as `readError`, for routes that answer with fetch. */
const readErrorLike = async (response: Response): Promise<Error> => {
  try {
    // SAFETY: the delete routes always answer errors with { error }.
    return toFailure(
      (await response.json()) as { code?: string; error?: string }
    );
  } catch {
    return new Error("The request failed. Check your connection.");
  }
};

/**
 * Uploads one file to a version. Uses XMLHttpRequest because fetch does not
 * report upload progress.
 */
export const uploadVersionFile = ({
  file,
  onProgress,
  platform,
  projectId,
  versionId,
}: UploadOptions): Promise<ProjectFileView> => {
  const uploadName = toUploadFilename(file.name);
  const params = new URLSearchParams({ filename: uploadName });

  if (platform) {
    params.set("platform", platform);
  }

  const url = `/api/projects/${projectId}/versions/${versionId}/files?${params}`;

  // oxlint-disable-next-line promise/avoid-new -- XMLHttpRequest has no promise API.
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", url);
    request.setRequestHeader(CONTENT_TYPE_HEADER, contentTypeFor(uploadName));
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        onProgress?.(event.loaded / event.total);
      }
    });
    request.addEventListener("load", () => {
      if (isSuccess(request.status)) {
        try {
          // SAFETY: a successful upload route always carries a ProjectFileView.
          resolve(JSON.parse(request.responseText) as ProjectFileView);
        } catch {
          reject(new Error(UPLOAD_FAILED_MESSAGE));
        }

        return;
      }

      reject(readError(request));
    });
    request.addEventListener("error", () =>
      reject(new Error(UPLOAD_FAILED_MESSAGE))
    );
    request.send(file);
  });
};

/** Removes one file from a release while leaving its sibling platform files intact. */
export const deleteVersionFile = async ({
  fileId,
  projectId,
  versionId,
}: {
  fileId: string;
  projectId: string;
  versionId: string;
}): Promise<void> => {
  const response = await fetch(
    `/api/projects/${projectId}/versions/${versionId}/files?fileId=${encodeURIComponent(fileId)}`,
    { method: "DELETE" }
  );

  if (!response.ok) {
    throw await readErrorLike(response);
  }
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
    request.setRequestHeader(CONTENT_TYPE_HEADER, payload.type);
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        onProgress?.(event.loaded / event.total);
      }
    });
    request.addEventListener("load", () => {
      if (isSuccess(request.status)) {
        try {
          // SAFETY: a successful image route always carries an image record.
          resolve(JSON.parse(request.responseText) as UploadedProjectImage);
        } catch {
          reject(new Error(UPLOAD_FAILED_MESSAGE));
        }

        return;
      }

      reject(readError(request));
    });
    request.addEventListener("error", () =>
      reject(new Error(UPLOAD_FAILED_MESSAGE))
    );
    request.send(payload);
  });
};

export interface UploadedAvatar {
  contentType: string;
  height: number;
  size: number;
  url: string;
  width: number;
}

/**
 * Uploads the signed-in account's avatar.
 *
 * Resized with the `icon` kind, which is the right one: an avatar is displayed
 * at 24-80px, exactly like a project icon, so it gets the same 512px ceiling
 * rather than a second constant for the same job.
 *
 * Uses XMLHttpRequest like the other uploads because `upload.onprogress` has no
 * promise equivalent.
 */
export const uploadAvatar = async ({
  file,
  onProgress,
}: {
  file: File;
  onProgress?: (fraction: number) => void;
}): Promise<UploadedAvatar> => {
  const payload = await resizeImageForUpload(file, "icon");

  // oxlint-disable-next-line promise/avoid-new -- XMLHttpRequest has no promise API.
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", "/api/users/me/avatar");
    request.setRequestHeader(CONTENT_TYPE_HEADER, payload.type);
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        onProgress?.(event.loaded / event.total);
      }
    });
    request.addEventListener("load", () => {
      if (isSuccess(request.status)) {
        try {
          // SAFETY: a successful avatar route always carries an avatar record.
          resolve(JSON.parse(request.responseText) as UploadedAvatar);
        } catch {
          reject(new Error(UPLOAD_FAILED_MESSAGE));
        }

        return;
      }

      reject(readError(request));
    });
    request.addEventListener("error", () =>
      reject(new Error(UPLOAD_FAILED_MESSAGE))
    );
    request.send(payload);
  });
};

/** Removes the signed-in account's avatar. */
export const deleteAvatar = async (): Promise<void> => {
  const response = await fetch("/api/users/me/avatar", { method: "DELETE" });

  if (!response.ok) {
    throw await readErrorLike(response);
  }
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
    throw await readErrorLike(response);
  }
};
