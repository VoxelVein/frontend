import { IconTrash, IconUpload } from "@tabler/icons-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth-client";
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

/**
 * Upload or remove the account's avatar.
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
  const [isBusy, setIsBusy] = useState(false);
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
      toast.error(errorMessage(actionError, "The avatar could not be saved."));
      setIsBusy(false);
      return;
    }

    // Refetch so the navbar, the account menu, and the public profile all pick
    // up the new `users.image` without this component caching a second copy.
    await authClient.getSession({ fetchOptions: { cache: "no-store" } });
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
