import { IconPhoto, IconTrash, IconUpload } from "@tabler/icons-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { ProjectImage } from "@/components/projects/project-image";
import { StorageGated } from "@/components/storage-gated";
import { Button } from "@/components/ui/button";
import { useStorageAvailable } from "@/hooks/use-storage-available";
import { errorMessage } from "@/lib/form-errors";
import { GALLERY_MAX_COUNT, IMAGE_MAX_BYTES } from "@/lib/image-limits";
import type { ProjectImageView } from "@/lib/project-images";
import { PROJECT_IMAGE_KIND } from "@/lib/projects";
import {
  STORAGE_UNAVAILABLE_REASON,
  storageFailureMessage,
  storageUnavailableNote,
} from "@/lib/storage-availability";
import { deleteProjectImage, uploadProjectImage } from "@/lib/upload-client";

const ACCEPT = "image/png,image/jpeg,image/webp,image/gif";

/** Shared empty gallery, so the icon variant keeps a stable array identity. */
const NO_IMAGES: ProjectImageView[] = [];

const formatMegabytes = (bytes: number) =>
  `${Math.round(bytes / 1_048_576)} MB`;

interface ImageManagerBase {
  onChange: (next: {
    gallery?: ProjectImageView[];
    icon?: ProjectImageView | null;
  }) => void;
  projectId: string;
  projectName: string;
}

type ImageManagerProps = ImageManagerBase &
  (
    | { kind: typeof PROJECT_IMAGE_KIND.icon; icon: ProjectImageView | null }
    | { kind: typeof PROJECT_IMAGE_KIND.gallery; gallery: ProjectImageView[] }
  );

/**
 * Uploads, replaces, and deletes one kind of project image.
 *
 * Used for both the icon and the gallery, which differ only in their copy and
 * their cap. The server is the authority on limits: it re-validates the type
 * and the size, and re-counts the gallery, so a stale client cannot push past
 * a cap by bypassing this component.
 */
const ImageManager = (props: ImageManagerProps) => {
  const { kind, onChange, projectId, projectName } = props;
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const { isAvailable: isStorageAvailable } = useStorageAvailable();

  const isIcon = kind === PROJECT_IMAGE_KIND.icon;

  // Split out of the union so each keeps its narrowed type; an icon project
  // has no gallery and a gallery project has no icon.
  const icon = props.kind === PROJECT_IMAGE_KIND.icon ? props.icon : null;
  const gallery =
    props.kind === PROJECT_IMAGE_KIND.gallery ? props.gallery : NO_IMAGES;
  const images: ProjectImageView[] = icon ? [icon] : gallery;
  const atLimit = gallery.length >= GALLERY_MAX_COUNT;

  const upload = async (file: File) => {
    toast.dismiss();
    setBusy(true);
    try {
      const uploaded = await uploadProjectImage({ file, kind, projectId });
      const view: ProjectImageView = {
        height: uploaded.height,
        id: uploaded.id,
        url: uploaded.url,
        width: uploaded.width,
      };
      if (isIcon) {
        // The server replaced the previous icon, so the local copy swaps too.
        onChange({ icon: view });
      } else {
        onChange({ gallery: [...gallery, view] });
      }
    } catch (uploadError) {
      toast.error(
        storageFailureMessage(uploadError, "The image could not be uploaded.")
      );
    }
    setBusy(false);
  };

  const remove = async (id: string) => {
    toast.dismiss();
    setBusy(true);
    try {
      await deleteProjectImage(projectId, id);
      if (isIcon) {
        onChange({ icon: null });
      } else {
        onChange({
          gallery: gallery.filter((item) => item.id !== id),
        });
      }
    } catch (deleteError) {
      toast.error(errorMessage(deleteError, "The image could not be deleted."));
    }
    setBusy(false);
  };

  const label = isIcon ? "Project icon" : "Gallery images";

  // The icon swaps in place, so its verb depends on whether there is one yet.
  const iconActionLabel = images.length > 0 ? "Replace icon" : "Upload icon";
  const uploadLabel = isIcon ? iconActionLabel : "Add images";

  return (
    <div className="grid gap-2">
      <span className="text-foreground text-sm font-medium">{label}</span>

      {images.length > 0 ? (
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {images.map((image, index) => (
            <li key={image.id} className="relative">
              <ProjectImage
                image={image}
                alt={
                  isIcon
                    ? `${projectName} icon`
                    : `${projectName} gallery image ${index + 1}`
                }
                ratio="square"
                className="border-border aspect-square rounded-lg border"
              />
              <Button
                type="button"
                variant="destructive"
                size="icon"
                disabled={busy}
                onClick={() => {
                  void remove(image.id);
                }}
                className="absolute top-1 right-1"
              >
                <IconTrash size={16} aria-hidden="true" />
                <span className="sr-only">
                  {isIcon
                    ? "Remove the project icon"
                    : `Remove gallery image ${index + 1}`}
                </span>
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground flex items-center gap-2 text-sm">
          <IconPhoto size={16} aria-hidden="true" />
          {isIcon
            ? "No icon yet. Without one, a letter tile is shown."
            : "No images yet."}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          id={`project-${kind}-upload`}
          disabled={busy || atLimit}
          onChange={(event) => {
            const file = event.target.files?.[0];
            // Reset so choosing the same file twice still fires a change.
            event.target.value = "";
            if (file) {
              void upload(file);
            }
          }}
        />
        {/* Gated on object storage; without it there is nowhere to put the
            bytes, so the control is disabled rather than failing after the
            reader has picked a file. */}
        <StorageGated reason={STORAGE_UNAVAILABLE_REASON}>
          {({ isAvailable }) => (
            <Button
              type="button"
              variant="outline"
              disabled={busy || atLimit || !isAvailable}
              onClick={() => inputRef.current?.click()}
            >
              <IconUpload size={16} aria-hidden="true" />
              {uploadLabel}
            </Button>
          )}
        </StorageGated>
        <span className="text-muted-foreground text-xs">
          PNG, JPEG, WebP, or GIF, up to {formatMegabytes(IMAGE_MAX_BYTES)}.
          Larger images are shrunk in your browser before uploading, so the
          full-size original is never stored.
          {/* Not "Limit reached (12)." — the bare number meant nothing next to
              "PNG, JPEG, WebP…", and a disabled upload button with no stated
              reason is the part users write in about. */}
          {!isIcon && atLimit
            ? ` You have all ${GALLERY_MAX_COUNT} gallery images. Remove one to add another.`
            : ""}
          {/* The tooltip is a pointer affordance; this is where the reason has
              to live for anyone not using a mouse. */}
          {isStorageAvailable ? "" : ` ${storageUnavailableNote("Uploads")}`}
        </span>
      </div>
    </div>
  );
};

export { ImageManager };
