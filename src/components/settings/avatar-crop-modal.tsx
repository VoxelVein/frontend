import { IconRefresh, IconUpload } from "@tabler/icons-react";
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
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
  centerCropOffset,
  clampCropOffset,
  cropZoomBounds,
  renderAvatarBlob,
  sourceCrop,
  zoomCropView,
} from "@/lib/image-resize";
import type { CropView, CropZoomBounds, Dimensions } from "@/lib/image-resize";

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
  image: HTMLImageElement;
  objectUrl: string | null;
  onPointerCancel: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLDivElement>) => void;
  view: CropView;
}

/**
 * The square crop window, the panned image, and the circular preview overlay.
 *
 * The window stays a square; the circle is only a preview overlay. Everything
 * outside it is dimmed, which is what draws the circle without clipping the
 * square that gets uploaded.
 */
const CropPreview = ({
  image,
  objectUrl,
  onPointerCancel,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  view,
}: CropPreviewProps) => {
  const { offset, zoom } = view;
  const radius = CROP_WINDOW_SIZE / 2;

  return (
    <div
      aria-label="Avatar crop area"
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
        <defs>
          <mask id="avatar-crop-circle">
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
          mask="url(#avatar-crop-circle)"
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
      </svg>
    </div>
  );
};

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
 * The crop window is the square 1:1 area that gets uploaded. The circle is a
 * semi-transparent scrim over the corners that previews how an avatar is
 * displayed, without rounding the stored image, so nothing is lost to the
 * shape. Zoom covers the slider, the wheel, and pinch; panning covers drags.
 * Leaving the dialog revokes the temporary object URL.
 */
export const AvatarCropModal = ({
  file,
  onCancel,
  onConfirm,
}: AvatarCropModalProps) => {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [view, dispatch] = useReducer(cropViewReducer, {
    offset: { x: 0, y: 0 },
    zoom: 1,
  });
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const viewportRef = useRef<HTMLDivElement>(null);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null);
  const pinchDistanceRef = useRef<number | null>(null);

  useEffect(() => {
    if (!file) {
      return;
    }

    // Created here rather than in render so StrictMode's mount/unmount/mount
    // cycle gets a fresh URL each time instead of one that was just revoked.
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

    if (!(viewport && bounds && dimensions)) {
      return;
    }

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

    return () => viewport.removeEventListener("wheel", handleWheel);
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
      const blob = await renderAvatarBlob(image, source, AVATAR_OUTPUT_SIZE);

      if (!blob) {
        setIsSaving(false);
        setSaveError("That image could not be prepared. Try another picture.");

        return;
      }

      // Stays busy until the dialog closes, so a second click cannot start a
      // second crop while the first one is being handed to the uploader.
      onConfirm(new File([blob], "avatar.webp", { type: blob.type }));
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
            <CropPreview
              image={image}
              objectUrl={objectUrl}
              onPointerCancel={releasePointer}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={releasePointer}
              view={view}
            />

            <div className="flex flex-col gap-2">
              <label
                className="text-muted-foreground text-sm"
                htmlFor="avatar-zoom"
              >
                Zoom
              </label>
              <Slider
                className="w-full"
                disabled={!bounds}
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
