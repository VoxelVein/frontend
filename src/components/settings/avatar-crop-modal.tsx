import { IconRefresh, IconUpload } from "@tabler/icons-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import {
  AVATAR_OUTPUT_SIZE,
  CROP_WINDOW_SIZE,
  clampCropOffset,
  renderAvatarBlob,
  sourceCrop,
} from "@/lib/image-resize";

/** How far the zoom control may push the framing. */
const MAX_ZOOM = 8;

interface AvatarCropModalProps {
  /** The validated image waiting to be framed. */
  file: File;
  /** Closes the dialog without uploading anything. */
  onCancel: () => void;
  /** Receives the cropped, optimized avatar file to upload. */
  onConfirm: (file: File) => void;
}

/**
 * Frames a square avatar out of an uploaded image.
 *
 * The crop window is locked to a square at `CROP_WINDOW_SIZE`, the preview is
 * clipped to a circle of that diameter, and the framing is carried as a source
 * crop so the confirmed square can be re-rendered onto a canvas. Zoom covers
 * the slider and the scroll wheel; panning covers drags, with pinch zooming for
 * touch. Leaving the dialog revokes the temporary object URL.
 */
export const AvatarCropModal = ({
  file,
  onCancel,
  onConfirm,
}: AvatarCropModalProps) => {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const viewportRef = useRef<HTMLDivElement>(null);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null);
  const pinchRef = useRef<{ distance: number; zoom: number } | null>(null);

  useEffect(() => {
    if (!file) {
      return;
    }

    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    const element = new Image();
    element.src = url;
    let cancelled = false;

    element
      .decode()
      .then(() => {
        if (cancelled) {
          return;
        }

        setFailed(false);
        setImage(element);
        // Starts at zero zoom: the window fits the source square rather than
        // magnifying it, so the whole picture is framed before the person
        // decides what part of it they actually want.
        setZoom(
          CROP_WINDOW_SIZE /
            Math.min(element.naturalWidth, element.naturalHeight)
        );
        setOffset({ x: 0, y: 0 });
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true);
        }
      });

    return () => {
      cancelled = true;
      URL.revokeObjectURL(url);
      setObjectUrl(null);
    };
  }, [file]);

  const dimensions = image
    ? { height: image.naturalHeight, width: image.naturalWidth }
    : null;

  const minZoom =
    dimensions === null
      ? 0.05
      : Math.max(
          CROP_WINDOW_SIZE / Math.max(dimensions.width, dimensions.height),
          0.05
        );

  const maxZoom =
    dimensions === null
      ? MAX_ZOOM
      : Math.max(
          CROP_WINDOW_SIZE / Math.min(dimensions.width, dimensions.height),
          minZoom
        ) * 8;

  const applyZoom = useCallback(
    (next: number) => {
      const clamped = Math.min(maxZoom, Math.max(minZoom, next));
      setZoom(clamped);
      // Keep the window's centre where it was rather than jumping.
      setOffset((current) => {
        const centerX = current.x + CROP_WINDOW_SIZE / 2;
        const centerY = current.y + CROP_WINDOW_SIZE / 2;

        return dimensions
          ? clampCropOffset(
              clamped,
              CROP_WINDOW_SIZE,
              {
                x: centerX - CROP_WINDOW_SIZE / 2,
                y: centerY - CROP_WINDOW_SIZE / 2,
              },
              dimensions
            )
          : { x: 0, y: 0 };
      });
    },
    [dimensions, maxZoom, minZoom]
  );

  // The zoom control is the slider; the wheel is the same operation, applied
  // around the centre so the framing follows the gesture.
  useEffect(() => {
    const viewport = viewportRef.current;

    if (!viewport) {
      return;
    }

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      applyZoom(zoom * Math.exp(-event.deltaY * 0.001));
    };

    viewport.addEventListener("wheel", handleWheel, { passive: false });

    return () => viewport.removeEventListener("wheel", handleWheel);
  }, [applyZoom, zoom]);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointersRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    lastPointerRef.current = { x: event.clientX, y: event.clientY };
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const previous = lastPointerRef.current;

    if (!previous) {
      return;
    }

    const deltaX = event.clientX - previous.x;
    const deltaY = event.clientY - previous.y;
    lastPointerRef.current = { x: event.clientX, y: event.clientY };
    pointersRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });

    if (pointersRef.current.size > 1) {
      const [first, second] = [...pointersRef.current.values()];
      const distance = Math.hypot(first.x - second.x, first.y - second.y);

      const midpoint = {
        x: (first.x + second.x) / 2,
        y: (first.y + second.y) / 2,
      };

      const previousPinch = pinchRef.current;

      if (previousPinch) {
        applyZoom(previousPinch.zoom * (distance / previousPinch.distance));
      }

      pinchRef.current = { distance, zoom };
      const nextZoom = pinchRef.current.zoom;

      if (dimensions) {
        const x = midpoint.x / nextZoom - CROP_WINDOW_SIZE / 2;
        const y = midpoint.y / nextZoom - CROP_WINDOW_SIZE / 2;
        setOffset(() =>
          clampCropOffset(nextZoom, CROP_WINDOW_SIZE, { x, y }, dimensions)
        );
      }

      return;
    }

    pinchRef.current = null;

    if (!dimensions) {
      return;
    }

    setOffset((current) =>
      clampCropOffset(
        zoom,
        CROP_WINDOW_SIZE,
        { x: current.x - deltaX, y: current.y - deltaY },
        dimensions
      )
    );
  };

  const releasePointer = (event: PointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(event.pointerId);

    if (pointersRef.current.size < 2) {
      pinchRef.current = null;
    }

    lastPointerRef.current = null;
  };

  const handleReset = () => {
    setSaveError(null);
    setOffset({ x: 0, y: 0 });

    if (dimensions) {
      // The reset returns to the same zero-zoom framing the modal opens with.
      setZoom(CROP_WINDOW_SIZE / Math.min(dimensions.width, dimensions.height));
    }
  };

  const handleSave = async () => {
    if (!image || isSaving) {
      return;
    }

    setSaveError(null);
    const source = sourceCrop(zoom, CROP_WINDOW_SIZE, offset);
    const blob = await renderAvatarBlob(image, source, AVATAR_OUTPUT_SIZE);

    if (!blob) {
      setSaveError("That image could not be prepared. Try another picture.");

      return;
    }

    setIsSaving(true);
    onConfirm(new File([blob], "avatar.webp", { type: blob.type }));
  };

  const canSave = image !== null && !failed && !isSaving && !saveError;

  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open) {
          onCancel();
        }
      }}
      open
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Crop your picture</DialogTitle>
          <DialogDescription>
            Frame your picture as a square. It is resized and optimized before
            it is uploaded.
          </DialogDescription>
        </DialogHeader>

        {failed ? (
          <p className="text-muted-foreground text-sm">
            That picture could not be loaded, so it cannot be cropped.
          </p>
        ) : null}

        {image ? (
          <div className="flex flex-col gap-4">
            <div
              aria-label="Avatar crop area"
              className="bg-muted/40 relative mx-auto overflow-hidden rounded-full"
              style={{ height: CROP_WINDOW_SIZE, width: CROP_WINDOW_SIZE }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={releasePointer}
              onPointerCancel={releasePointer}
            >
              <img
                alt=""
                className="pointer-events-none absolute top-0 left-0"
                draggable={false}
                style={{
                  height: image.naturalHeight * zoom,
                  width: image.naturalWidth * zoom,
                }}
                src={objectUrl ?? undefined}
              />
              {/* The frame is a semi-transparent overlay shaped into the circle,
                  not a border: the radius alone draws the circle, and the alpha
                  keeps it a suggestion rather than a hard ring. */}
              <div
                aria-hidden="true"
                className="bg-foreground/10 absolute rounded-full"
                style={{
                  height: CROP_WINDOW_SIZE,
                  left: offset.x,
                  top: offset.y,
                  width: CROP_WINDOW_SIZE,
                }}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label
                className="text-muted-foreground text-sm"
                htmlFor="avatar-zoom"
              >
                Zoom
              </label>
              <Slider
                className="w-full"
                max={maxZoom}
                min={minZoom}
                onValueChange={(next) =>
                  setZoom(Array.isArray(next) ? next[0] : next)
                }
                value={[zoom]}
              />
            </div>

            <DialogFooter className="gap-2">
              <Button
                className="min-h-11"
                disabled={isSaving}
                onClick={handleReset}
                type="button"
                variant="outline"
              >
                <IconRefresh aria-hidden="true" />
                Reset
              </Button>
              <Button
                className="min-h-11"
                onClick={onCancel}
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
              <Button
                className="min-h-11"
                disabled={!canSave}
                onClick={() => {
                  void handleSave();
                }}
                type="button"
              >
                <IconUpload aria-hidden="true" />
                Save picture
              </Button>
            </DialogFooter>
          </div>
        ) : null}

        {saveError ? (
          <p className="text-destructive text-sm" role="alert">
            {saveError}
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};
