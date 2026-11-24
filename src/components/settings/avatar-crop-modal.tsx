import { ImageCropModal } from "@/components/image-crop-modal";
import { renderAvatarBlob } from "@/lib/image-resize";

interface AvatarCropModalProps {
  /** The validated image waiting to be framed. */
  file: File;
  /** Closes the dialog without uploading anything. */
  onCancel: () => void;
  /** Receives the cropped, optimized avatar file to upload. */
  onConfirm: (file: File) => void;
}

/**
 * The avatar-specific framing of the shared image cropper.
 *
 * A profile picture is displayed inside a circle, so the preview dims the
 * corners; the stored file stays a flat square, as it always has. Everything
 * else  -  zoom, pan, pinch, and the WebP encoding  -  is the same control a
 * project icon uses.
 */
const AvatarCropModal = ({
  file,
  onCancel,
  onConfirm,
}: AvatarCropModalProps) => (
  <ImageCropModal
    areaLabel="Avatar crop area"
    confirmLabel="Save picture"
    description="Frame your picture as a square. It is resized and optimized before it is uploaded."
    encode={renderAvatarBlob}
    file={file}
    onCancel={onCancel}
    onConfirm={onConfirm}
    outputName="avatar.webp"
    preview="circle"
    title="Crop your picture"
  />
);

export { AvatarCropModal };
