import { IconRefresh, IconUpload } from "@tabler/icons-react";
import { useEffect, useId, useMemo, useReducer, useRef, useState } from "react";
import type { PointerEvent, RefObject } from "react";

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
  AVATAR_WEBP_QUALITY,
  CROP_WINDOW_SIZE,
  centerCropOffset,
  clampCropOffset,
  cropZoomBounds,
  renderImageToBlob,
  sourceCrop,
  zoomCropView,
} from "@/lib/image-resize";
import type {
  CropRect,
  CropView,
  CropZoomBounds,
  Dimensions,
} from "@/lib/image-resize";

/** Slider positions; the zoom itself is mapped logarithmically across them. */
const ZOOM_SLIDER_MAX = 100;

type CropAction =
  | { type: "pan"; dimensions: Dimensions; dx: number; dy: number }
  | { type: "reset"; dimensions: Dimensions; zoom: number }
  | {
      type: "zoomBy";
      bounds: CropZoomBounds;
      dimensions: Dimensions;
      factor: number;
    }
  | {
      type: "zoomTo";
      bounds: CropZoomBounds;
      dimensions: Dimensions;
      zoom: number;
    };

const clampZoom = (zoom: number, { max, min }: CropZoomBounds): number =>
  Math.min(max, Math.max(min, zoom));

/**
 * Owns the whole framing so zoom and pan cannot drift apart.
 *
 * A single reducer keeps the offset valid for the zoom that replaces it, which
 * is what lets the wheel, the slider, and a pinch all move smoothly: the image
 * grows around the window centre and the pan is clamped in the same step.
 */
const cropViewReducer = (view: CropView, action: CropAction): CropView => {
  switch (action.type) {
    case "pan": {
      return {
        offset: clampCropOffset(
          view.zoom,
          CROP_WINDOW_SIZE,
          { x: view.offset.x - action.dx, y: view.offset.y - action.dy },
          action.dimensions
        ),
        zoom: view.zoom,
      };
    }

    case "reset": {
      return {
        offset: centerCropOffset(
          action.zoom,
          CROP_WINDOW_SIZE,
          action.dimensions
        ),
        zoom: action.zoom,
      };
    }

    case "zoomBy": {
      return zoomCropView(
        view,
        clampZoom(view.zoom * action.factor, action.bounds),
        CROP_WINDOW_SIZE,
        action.dimensions
      );
    }

    case "zoomTo": {
      return zoomCropView(
        view,
        clampZoom(action.zoom, action.bounds),
        CROP_WINDOW_SIZE,
        action.dimensions
      );
    }

    default: {
      return view;
    }
  }
};

/** Maps a zoom onto the 0-100 slider evenly by ratio, not by pixel count. */
const zoomToPercent = (zoom: number, { max, min }: CropZoomBounds): number => {
  const range = Math.log(max / min);

  if (range === 0) {
    return 0;
  }

  return Math.min(
    ZOOM_SLIDER_MAX,
    Math.max(0, (Math.log(zoom / min) / range) * ZOOM_SLIDER_MAX)
  );
};

/** Inverse of `zoomToPercent`. */
const percentToZoom = (percent: number, { max, min }: CropZoomBounds): number =>
  min * (max / min) ** (percent / ZOOM_SLIDER_MAX);

interface CropPreviewProps {
  areaLabel: string;
  image: HTMLImageElement;
  maskId: string;
  objectUrl: string | null;
  onPointerCancel: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLDivElement>) => void;
  preview: "circle" | "square";
  /** The wheel listener is bound to the viewport, so the ref has to land here. */
  viewportRef: RefObject<HTMLDivElement | null>;
  view: CropView;
}

/**
 * The square crop window, the panned image, and the preview overlay.
 *
 * The window is what actually gets uploaded. A circle only dims the corners so
 * an avatar can be judged as a circle; a square just outlines the real edge,
 * which is what a project logo needs. Neither changes the uploaded pixels.
 */
const CropPreview = ({
  areaLabel,
  image,
  maskId,
  objectUrl,
  onPointerCancel,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  preview,
  viewportRef,
  view,
}: CropPreviewProps) => {
  const { offset, zoom } = view;
  const radius = CROP_WINDOW_SIZE / 2;

  return (
    <div
      ref={viewportRef}
      aria-label={areaLabel}
      className="bg-muted/40 ring-border relative mx-auto touch-none overflow-hidden ring-1 select-none"
      style={{ height: CROP_WINDOW_SIZE, width: CROP_WINDOW_SIZE }}
      onPointerCancel={onPointerCancel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <img
        alt=""
        className="pointer-events-none absolute top-0 left-0 max-w-none"
        draggable={false}
        style={{
          height: image.naturalHeight * zoom,
          transform: `translate3d(${-offset.x}px, ${-offset.y}px, 0)`,
          width: image.naturalWidth * zoom,
        }}
        src={objectUrl ?? undefined}
      />
      <svg
        aria-hidden="true"
        className="text-foreground pointer-events-none absolute inset-0 h-full w-full"
        viewBox={`0 0 ${CROP_WINDOW_SIZE} ${CROP_WINDOW_SIZE}`}
      >
        {preview === "circle" ? (
          <>
            <defs>
              <mask id={maskId}>
                <rect
                  fill="white"
                  height={CROP_WINDOW_SIZE}
                  width={CROP_WINDOW_SIZE}
                />
                <circle cx={radius} cy={radius} fill="black" r={radius} />
              </mask>
            </defs>
            <rect
              fill="currentColor"
              fillOpacity={0.4}
              height={CROP_WINDOW_SIZE}
              mask={`url(#${maskId})`}
              width={CROP_WINDOW_SIZE}
            />
            <circle
              cx={radius}
              cy={radius}
              fill="none"
              r={radius - 0.5}
              stroke="currentColor"
              strokeOpacity={0.35}
              strokeWidth={1}
            />
          </>
        ) : (
          <rect
            fill="none"
            height={CROP_WINDOW_SIZE - 1}
            stroke="currentColor"
            strokeOpacity={0.35}
            strokeWidth={1}
            width={CROP_WINDOW_SIZE - 1}
            x={0.5}
            y={0.5}
          />
        )}
      </svg>
    </div>
  );
};

export interface ImageCropModalProps {
  /** Accessible name for the framing area, e.g. "Project icon crop area". */
  areaLabel: string;
  confirmLabel: string;
  description: string;
  /**
   * Encodes the framed square. Callers can pass `renderAvatarBlob` for the
   * avatar defaults, or any other encoder; the fallback produces an optimized
   * square WebP.
   */
  encode?: (image: HTMLImageElement, crop: CropRect) => Promise<Blob | null>;
  /** The validated image waiting to be framed. */
  file: File;
  /** Closes the dialog without uploading anything. */
  onCancel: () => void;
  /** Receives the cropped, optimized image to upload. */
  onConfirm: (file: File) => void;
  /** Name given to the cropped file handed back to the uploader. */
  outputName: string;
  /** Circle for avatars, square for logos and other icons. */
  preview?: "circle" | "square";
  title: string;
}

/**
 * Frames a square image out of an uploaded file.
 *
 * The crop window is the square 1:1 area that gets uploaded. Zoom covers the
 * slider, the wheel, and pinch; panning covers drags. Leaving the dialog revokes
 * the temporary object URL. Both the avatar and project icon uploads use this
 * same view, so their framing behaves identically.
 */
// oxlint-disable-next-line react-doctor/no-giant-component -- The crop preview, gesture handling and save flow share one view reducer; splitting them would need a larger refactor
export const ImageCropModal = ({
  areaLabel,
  confirmLabel,
  description,
  encode,
  file,
  onCancel,
  onConfirm,
  outputName,
  preview = "square",
  title,
}: ImageCropModalProps) => {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const sliderId = useId();
  const maskId = useId();

  const [view, dispatch] = useReducer(cropViewReducer, {
    offset: { x: 0, y: 0 },
    zoom: 1,
  });

  const viewportRef = useRef<HTMLDivElement>(null);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null);
  const pinchDistanceRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    let url: string | null = null;

    if (file) {
      // Created here rather than in render so StrictMode's mount/unmount/mount
      // cycle gets a fresh URL each time instead of one that was just revoked.
      // oxlint-disable-next-line react-doctor/no-create-object-url-without-revoke -- Revoked in the cleanup returned by this effect.
      url = URL.createObjectURL(file);
      // oxlint-disable-next-line react/set-state-in-effect -- The URL is an external browser resource created per mount; publishing it to state is the synchronization itself and cannot cascade a render.
      setObjectUrl(url);
      const element = new Image();
      element.src = url;

      const decodeImage = async () => {
        try {
          await element.decode();
        } catch {
          if (!cancelled) {
            setFailed(true);
          }

          return;
        }

        if (cancelled) {
          return;
        }

        const size = {
          height: element.naturalHeight,
          width: element.naturalWidth,
        };

        setFailed(false);
        setImage(element);
        // Starts at 0%: the shorter edge fills the square exactly, centred on
        // the picture, so the whole framing is visible before deciding what to
        // keep. The bounds come from the source size, not a fixed range.
        dispatch({
          type: "reset",
          zoom: cropZoomBounds(size).min,
          dimensions: size,
        });
      };

      void decodeImage();
    }

    return () => {
      cancelled = true;

      if (url) {
        URL.revokeObjectURL(url);
      }

      setObjectUrl(null);
    };
  }, [file]);

  // Memoised so the wheel listener is attached once per image rather than being
  // torn down and rebuilt on every frame while the picture zooms.
  const dimensions = useMemo<Dimensions | null>(
    () =>
      image ? { height: image.naturalHeight, width: image.naturalWidth } : null,
    [image]
  );

  const bounds = useMemo(
    () => (dimensions ? cropZoomBounds(dimensions) : null),
    [dimensions]
  );

  const { offset, zoom } = view;

  useEffect(() => {
    const viewport = viewportRef.current;
    let detach: (() => void) | null = null;

    if (viewport && bounds && dimensions) {
      const handleWheel = (event: WheelEvent) => {
        event.preventDefault();
        // One notch is a small multiplicative step. Clamping the delta stops a
        // trackpad flick from crossing the whole range in one event.
        const delta = Math.min(100, Math.max(-100, event.deltaY));

        dispatch({
          type: "zoomBy",
          factor: Math.exp(-delta * 0.0018),
          bounds,
          dimensions,
        });
      };

      viewport.addEventListener("wheel", handleWheel, { passive: false });
      detach = () => viewport.removeEventListener("wheel", handleWheel);
    }

    return () => detach?.();
  }, [bounds, dimensions]);

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

    if (!(previous && bounds && dimensions)) {
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
      const lastDistance = pinchDistanceRef.current;

      pinchDistanceRef.current = distance;

      if (lastDistance !== null && lastDistance > 0) {
        dispatch({
          type: "zoomBy",
          factor: distance / lastDistance,
          bounds,
          dimensions,
        });
      }

      return;
    }

    pinchDistanceRef.current = null;
    dispatch({ type: "pan", dx: deltaX, dy: deltaY, dimensions });
  };

  const releasePointer = (event: PointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(event.pointerId);

    if (pointersRef.current.size < 2) {
      pinchDistanceRef.current = null;
    }

    // Keep panning with whichever finger is still down.
    lastPointerRef.current = pointersRef.current.values().next().value ?? null;
  };

  const handleReset = () => {
    setSaveError(null);

    if (bounds && dimensions) {
      dispatch({ type: "reset", zoom: bounds.min, dimensions });
    }
  };

  const handleSave = async () => {
    if (!(image && dimensions) || isSaving) {
      return;
    }

    setSaveError(null);
    setIsSaving(true);

    try {
      const source = sourceCrop(zoom, CROP_WINDOW_SIZE, offset);

      const blob = encode
        ? await encode(image, source)
        : await renderImageToBlob(
            image,
            source,
            AVATAR_OUTPUT_SIZE,
            "image/webp",
            AVATAR_WEBP_QUALITY
          );

      if (!blob) {
        setIsSaving(false);
        setSaveError("That image could not be prepared. Try another picture.");

        return;
      }

      // Stays busy until the dialog closes, so a second click cannot start a
      // second crop while the first one is being handed to the uploader.
      onConfirm(new File([blob], outputName, { type: blob.type }));
    } catch {
      setIsSaving(false);
      setSaveError("That image could not be prepared. Try another picture.");
    }
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
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {failed ? (
          <p className="text-muted-foreground text-sm">
            That picture could not be loaded, so it cannot be cropped.
          </p>
        ) : null}

        {image ? (
          <div className="flex flex-col gap-4">
            <CropPreview
              areaLabel={areaLabel}
              image={image}
              maskId={maskId}
              objectUrl={objectUrl}
              onPointerCancel={releasePointer}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={releasePointer}
              preview={preview}
              viewportRef={viewportRef}
              view={view}
            />

            <div className="flex flex-col gap-2">
              <label
                className="text-muted-foreground text-sm"
                htmlFor={sliderId}
              >
                Zoom
              </label>
              <Slider
                className="w-full"
                disabled={!bounds}
                id={sliderId}
                max={ZOOM_SLIDER_MAX}
                min={0}
                onValueChange={(next) => {
                  if (!(bounds && dimensions)) {
                    return;
                  }

                  const percent = Array.isArray(next) ? next[0] : next;

                  dispatch({
                    type: "zoomTo",
                    zoom: percentToZoom(percent, bounds),
                    bounds,
                    dimensions,
                  });
                }}
                step={1}
                value={[bounds ? zoomToPercent(zoom, bounds) : 0]}
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
                {confirmLabel}
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
