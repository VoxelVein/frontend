import {
  IconLink,
  IconPhoto,
  IconTrash,
  IconUpload,
} from "@tabler/icons-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/form-field";
import { StorageGated } from "@/components/storage-gated";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRefreshSession } from "@/hooks/use-refresh-session";
import { useStorageAvailable } from "@/hooks/use-storage-available";
import { setAvatarUrl } from "@/lib/account.functions";
import { isExternalAvatarSrc, parseAvatarUrl } from "@/lib/avatar-url";
import { formatBytes } from "@/lib/format";
import { IMAGE_MAX_BYTES } from "@/lib/image-limits";
import {
  STORAGE_UNAVAILABLE_REASON,
  storageFailureMessage,
  storageUnavailableNote,
} from "@/lib/storage-availability";
import { deleteAvatar, uploadAvatar } from "@/lib/upload-client";

interface AvatarCardProps {
  /** The current avatar URL, or null when the account has none. */
  image: string | null;
  /** Used for the letter tile and the alt text. */
  name: string;
}

const ACCEPT = "image/png,image/jpeg,image/webp,image/gif";

const UPLOAD_HELPER =
  "Square images look best. Larger images are shrunk in your browser before uploading, so the full-size original is never stored.";

const URL_HELPER =
  "An https:// address of an image you already host. This works even when uploads are switched off.";

/**
 * Where the picture currently lives.
 *
 * Said in words rather than left to the preview to imply: a stored path and a
 * third-party URL render identically, and the difference decides who serves the
 * image to every visitor.
 */
const SourceNote = ({ image }: { image: string | null }) => {
  if (!image) {
    return (
      <p className="text-muted-foreground text-sm">
        No picture yet. You will see this initial until you add one.
      </p>
    );
  }

  return (
    <p className="text-muted-foreground text-sm">
      {isExternalAvatarSrc(image) ? (
        <>
          Loaded from another site. Everyone who sees your profile loads it from
          there, and that host can see who looked.
        </>
      ) : (
        <>Stored on VoxelVein and served from here.</>
      )}
    </p>
  );
};

/**
 * A live preview of a typed URL, before it is saved.
 *
 * The point of the whole URL field: without it the only way to find out whether
 * an address points at a usable picture is to save it, reload the page, and look
 * at the result. A broken URL is caught here instead, next to the mistake.
 */
const UrlPreview = ({ url }: { url: string }) => {
  const parsed = parseAvatarUrl(url);
  const [failed, setFailed] = useState(false);

  if (!parsed.ok || parsed.url === null) {
    return null;
  }

  return (
    <div className="flex items-center gap-3">
      {failed ? (
        <div
          aria-hidden="true"
          className="border-border bg-muted/40 text-muted-foreground flex size-14 shrink-0 items-center justify-center rounded-full border"
        >
          <IconPhoto size={20} stroke={1.5} />
        </div>
      ) : (
        <img
          alt=""
          className="border-border size-14 shrink-0 rounded-full border object-cover"
          decoding="async"
          height={56}
          // No referrer here either: a preview is a request to a third-party host
          // made while the person is still deciding, and it should not tell them
          // which account page they are on.
          referrerPolicy="no-referrer"
          src={parsed.url}
          width={56}
          onError={() => setFailed(true)}
        />
      )}

      <p className="text-muted-foreground text-sm">
        {failed ? (
          <>
            <span className="text-destructive font-medium">
              That address did not load an image.
            </span>{" "}
            Check it opens in a browser tab.
          </>
        ) : (
          <>Preview of the image you typed.</>
        )}
      </p>
    </div>
  );
};

/**
 * Upload, link, or remove the account's profile picture.
 *
 * The two sources are **tabs** rather than two stacked forms. They are
 * alternatives — a picture comes from exactly one of them — and showing both at
 * once gave the URL field the visual weight of a second primary action while
 * making it unclear which one the card was asking about.
 *
 * `users.image` is whichever source was used, and it is what every avatar
 * surface reads, so the card names the source in words rather than leaving the
 * preview to imply it.
 *
 * The file never leaves the device at full size: `uploadAvatar` resizes it with
 * the `icon` kind first, so a phone photo is scaled before it is sent rather
 * than stored and never used.
 *
 * The session is invalidated after a change rather than caching the returned
 * URL here, because `users.image` is what Better Auth serves and what every
 * avatar surface reads. One source of truth beats a second copy in this
 * component.
 */
const AvatarCard = ({ image, name }: AvatarCardProps) => {
  const refreshSession = useRefreshSession();
  const { isAvailable: isStorageAvailable } = useStorageAvailable();
  const [isBusy, setIsBusy] = useState(false);
  const [url, setUrl] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // `catch` rather than a rejection handler, and no `finally`: the React
  // compiler cannot lower a finalizer clause, and clearing the flag on each
  // branch says the same thing.
  const withBusy = async (action: () => Promise<void>) => {
    toast.dismiss();
    setIsBusy(true);

    try {
      await action();
    } catch (actionError) {
      toast.error(
        storageFailureMessage(actionError, "The avatar could not be saved.")
      );
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
    setConfirmRemove(false);
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
            Shown next to your name across the site.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="flex items-start gap-4">
            {/* 80px rather than a navbar avatar's 24px: this is the one screen
                where the person is choosing the picture, so it is the one place
                a thumbnail is too small to judge. */}
            {image ? (
              <img
                alt=""
                className="border-border size-20 shrink-0 rounded-full border object-cover"
                decoding="async"
                height={80}
                loading="lazy"
                // The picture may be hosted elsewhere, and a referrer would tell
                // that host which account page a visitor was reading.
                referrerPolicy="no-referrer"
                src={image}
                width={80}
              />
            ) : (
              <div
                aria-hidden="true"
                className="border-border bg-primary/10 text-primary flex size-20 shrink-0 items-center justify-center rounded-full border text-2xl font-bold"
              >
                {name.charAt(0)}
              </div>
            )}
            <div className="min-w-0 flex-1 space-y-2">
              <p className="text-foreground text-sm font-medium">
                {image ? "Your current picture" : "No picture yet"}
              </p>
              <SourceNote image={image} />

              {image ? (
                <Button
                  className="mt-1"
                  disabled={isBusy}
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setConfirmRemove(true);
                  }}
                >
                  <IconTrash size={16} aria-hidden="true" />
                  Remove picture
                </Button>
              ) : null}
            </div>
          </div>

          <Tabs defaultValue="upload" className="mt-6">
            <TabsList aria-label="Picture source">
              <TabsTrigger value="upload">
                <IconUpload size={16} aria-hidden="true" />
                Upload
              </TabsTrigger>
              <TabsTrigger value="url">
                <IconLink size={16} aria-hidden="true" />
                From a URL
              </TabsTrigger>
            </TabsList>

            <TabsContent value="upload" className="mt-4 grid gap-4">
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

              {/* Gated on object storage: without it there is nowhere to put the
                  bytes, so the control is disabled and says so rather than
                  failing after the reader has picked a file. */}
              <StorageGated reason={STORAGE_UNAVAILABLE_REASON}>
                {({ isAvailable }) => (
                  <Button
                    className="w-full sm:w-auto sm:px-6"
                    type="button"
                    variant="outline"
                    disabled={isBusy || !isAvailable}
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
                        {image ? "Replace picture" : "Upload a picture"}
                      </>
                    )}
                  </Button>
                )}
              </StorageGated>

              {/* The tooltip is a pointer affordance; this is where the reason
                  actually has to live, because a tooltip is unreachable by
                  keyboard and absent on touch. */}
              {isStorageAvailable ? null : (
                <p className="text-muted-foreground text-sm">
                  {storageUnavailableNote("Uploads")}
                </p>
              )}

              <Alert>
                <AlertDescription>
                  PNG, JPEG, WebP, or GIF, up to {formatBytes(IMAGE_MAX_BYTES)}.
                  {UPLOAD_HELPER}
                </AlertDescription>
              </Alert>
            </TabsContent>

            <TabsContent value="url" className="mt-4">
              <form
                className="grid gap-4"
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

                {/* Keyed on the URL so editing it remounts the preview: a
                    failure belongs to the address that produced it, and
                    without the remount a corrected URL would keep showing the
                    previous address's error. */}
                <UrlPreview key={url} url={url} />

                <Button
                  className="w-full sm:w-auto sm:px-6"
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
                      Use this image
                    </>
                  )}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          {/* Removing an uploaded picture deletes the stored object, so it is
              confirmed rather than done on one click — and the dialog says which
              of the two sources is being removed, because the consequences
              differ: an uploaded picture is destroyed, a linked one is simply
              unlinked. */}
          <ConfirmDialog
            open={confirmRemove}
            onOpenChange={setConfirmRemove}
            title="Remove your picture?"
            description={
              isExternalAvatarSrc(image)
                ? "Your profile will go back to showing your initial. The image itself stays where it is."
                : "Your profile will go back to showing your initial, and the stored copy is deleted. You would need to upload it again to get it back."
            }
            /* Distinct from the row button it confirms: two controls sharing an
               accessible name in one view is ambiguous to announce and to click,
               whichever of them the dialog happens to hide. */
            confirmLabel="Yes, remove it"
            variant="destructive"
            pending={isBusy}
            onConfirm={() => {
              void handleRemove();
            }}
          />
        </CardContent>
      </Card>
    </section>
  );
};

export { AvatarCard };
