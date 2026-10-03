import { IconLink, IconTrash, IconUpload } from "@tabler/icons-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/form-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useRefreshSession } from "@/hooks/use-refresh-session";
import { setAvatarUrl } from "@/lib/account.functions";
import { isExternalAvatarSrc, parseAvatarUrl } from "@/lib/avatar-url";
import { errorMessage } from "@/lib/form-errors";
import { formatBytes } from "@/lib/format";
import { IMAGE_MAX_BYTES } from "@/lib/image-limits";
import { deleteAvatar, uploadAvatar } from "@/lib/upload-client";

interface AvatarCardProps {
  /** The current avatar URL, or null when the account has none. */
  image: string | null;
  /** Used for the letter tile and the alt text. */
  name: string;
}

const ACCEPT = "image/png,image/jpeg,image/webp,image/gif";

const URL_HELPER =
  "An https:// address of an image you already host. Leave it empty and save to remove your picture.";

/**
 * Upload, link, or remove the account's profile picture.
 *
 * Two sources, one field. `users.image` is either a path this site serves or an
 * `https:` URL somewhere else, and whichever is stored is what every avatar
 * surface reads — so the card states which one is in use rather than letting the
 * preview imply it.
 *
 * The file never leaves the device at full size: `uploadAvatar` resizes it with
 * the `icon` kind first, so a phone photo is scaled before it is sent rather
 * than stored and never used.
 *
 * The session is refetched after a change rather than caching the returned URL
 * here, because `users.image` is what Better Auth serves and what every avatar
 * surface reads. One source of truth beats a second copy in this component.
 */
const AvatarCard = ({ image, name }: AvatarCardProps) => {
  const refreshSession = useRefreshSession();
  const [isBusy, setIsBusy] = useState(false);
  const [url, setUrl] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isExternal = isExternalAvatarSrc(image);

  // `catch` rather than a rejection handler, and no `finally`: the React
  // compiler cannot lower a finalizer clause, and clearing the flag on each
  // branch says the same thing.
  const withBusy = async (action: () => Promise<void>) => {
    toast.dismiss();
    setIsBusy(true);

    try {
      await action();
    } catch (actionError) {
      toast.error(errorMessage(actionError, "The avatar could not be saved."));
      setIsBusy(false);
      return;
    }

    // Notifies the cached session rather than fetching it again: the navbar,
    // the account menu, and the public profile all read `users.image` through
    // `useSession`, and a plain `getSession()` call left them showing the old
    // picture until the page was reloaded.
    await refreshSession();
    setIsBusy(false);
  };

  const handleFile = async (file: File) => {
    await withBusy(async () => {
      await uploadAvatar({ file });
    });
  };

  const handleRemove = async () => {
    await withBusy(async () => {
      await deleteAvatar();
    });
  };

  const handleSaveUrl = async () => {
    // Validated here as well as on the server so the field reports the reason
    // next to the input, rather than the server's error arriving as a toast with
    // no indication of which field was wrong.
    const parsed = parseAvatarUrl(url);
    if (!parsed.ok) {
      setUrlError(parsed.error);
      return;
    }

    setUrlError(null);
    await withBusy(async () => {
      await setAvatarUrl({ data: { url } });
      // Cleared on success only: the field is a command, not a mirror of the
      // stored value, and leaving a stale URL in it invites a second save of
      // something already applied.
      setUrl("");
    });
  };

  return (
    <section aria-labelledby="settings-avatar-heading">
      <Card>
        <CardHeader>
          {/* A real h2, not CardTitle: the primitive renders a div, and the
              section is labelled by this id. */}
          <h2
            className="text-foreground text-lg font-semibold"
            id="settings-avatar-heading"
          >
            Profile picture
          </h2>
          <CardDescription>
            Shown next to your name across the site. Square images look best.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="flex flex-wrap items-center gap-4">
            {image ? (
              <img
                alt=""
                className="border-border size-16 shrink-0 rounded-full border object-cover"
                decoding="async"
                height={64}
                loading="lazy"
                // The picture may be hosted elsewhere, and a referrer would tell
                // that host which account page a visitor was reading.
                referrerPolicy="no-referrer"
                src={image}
                width={64}
              />
            ) : (
              <div
                aria-hidden="true"
                className="border-border bg-primary/10 text-primary flex size-16 shrink-0 items-center justify-center rounded-full border text-xl font-bold"
              >
                {name.charAt(0)}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <input
                ref={inputRef}
                type="file"
                accept={ACCEPT}
                className="sr-only"
                id="avatar-upload"
                disabled={isBusy}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  // Reset so choosing the same file twice still fires a change.
                  event.target.value = "";
                  if (file) {
                    void handleFile(file);
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                disabled={isBusy}
                onClick={() => inputRef.current?.click()}
              >
                {isBusy ? (
                  <>
                    <Spinner className="mr-1" />
                    Saving…
                  </>
                ) : (
                  <>
                    <IconUpload size={16} aria-hidden="true" />
                    {image ? "Replace" : "Upload"}
                  </>
                )}
              </Button>

              {image ? (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={isBusy}
                  onClick={() => {
                    void handleRemove();
                  }}
                >
                  <IconTrash size={16} aria-hidden="true" />
                  Remove
                </Button>
              ) : null}
            </div>
          </div>

          {/* Stated rather than left to the preview to imply: the two sources
              are indistinguishable once rendered. */}
          {image ? (
            <p className="text-muted-foreground mt-3 text-sm">
              {isExternal
                ? "Hosted on another site. Everyone who sees your profile loads it from there."
                : "Stored on VoxelVein."}
            </p>
          ) : null}

          <form
            className="mt-5 grid gap-3 border-t pt-5"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              event.stopPropagation();
              void handleSaveUrl();
            }}
          >
            <FormField
              autoComplete="url"
              disabled={isBusy}
              error={urlError ?? undefined}
              helperText={URL_HELPER}
              id="avatar-url"
              inputMode="url"
              label="Image URL"
              onChange={(event) => {
                setUrl(event.target.value);
                if (urlError) {
                  setUrlError(null);
                }
              }}
              placeholder="https://example.com/avatar.png"
              spellCheck={false}
              type="url"
              value={url}
            />

            <Button
              className="min-h-11 w-full sm:w-auto sm:px-6"
              disabled={isBusy}
              type="submit"
              variant="outline"
            >
              {isBusy ? (
                <>
                  <Spinner className="mr-1" />
                  Saving…
                </>
              ) : (
                <>
                  <IconLink size={16} aria-hidden="true" />
                  Use image URL
                </>
              )}
            </Button>
          </form>

          <Alert className="mt-4">
            <AlertDescription>
              PNG, JPEG, WebP, or GIF, up to {formatBytes(IMAGE_MAX_BYTES)}.
              Larger images are shrunk in your browser before uploading, so the
              full-size original is never stored.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </section>
  );
};

export { AvatarCard };
