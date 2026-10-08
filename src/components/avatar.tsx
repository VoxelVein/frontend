import { cn } from "cn";

import { isSafeAvatarSrc } from "@/lib/avatar-url";

interface AvatarProps {
  className?: string;
  /**
   * Whether the image is meaningful on its own.
   *
   * Decorative is the default because the usual case is an avatar sitting beside
   * the name it belongs to — announcing "Hedi Zandi's avatar" immediately before
   * "Hedi Zandi" makes a screen reader say the name twice. Pass `false` only
   * where the avatar is the only representation of the person, such as inside an
   * icon-only control.
   */
  decorative?: boolean;
  /** Null when the account never uploaded one; initials are shown instead. */
  image: string | null;
  name: string;
  size?: "xs" | "sm" | "md";
}

const AVATAR_SIZE = {
  md: "size-10 text-sm",
  sm: "size-8 text-xs",
  xs: "size-6 text-[0.625rem]",
} as const;

/**
 * The first letter of a name, for accounts with no avatar.
 *
 * Falls back to "?" rather than rendering nothing: an empty circle reads as a
 * broken image, while a letter reads as an avatar that simply has no photo.
 */
const initialOf = (name: string): string => {
  const first = name.trim().charAt(0);

  return first ? first.toUpperCase() : "?";
};

/**
 * A user's picture, or their initial when there is none.
 *
 * Every account can reach a post byline, and most accounts are OAuth sign-ins
 * that never upload a photo, so the fallback is the common case rather than an
 * edge case. It is drawn in the primary colour so a row of them still reads as a
 * set of people.
 *
 * `isSafeAvatarSrc` decides whether the stored value is rendered at all. An
 * account can now point its picture at an external URL, and a provider profile
 * can supply one, so this is the one place every avatar — bylines included —
 * passes through. A value that is neither one of our `/api/avatar/...` paths nor
 * an `https:` URL renders as initials rather than as whatever scheme it names.
 */
const Avatar = ({
  className,
  decorative = true,
  image,
  name,
  size = "sm",
}: AvatarProps) => (
  <span
    className={cn(
      // Block-level (not inline-flex): an inline-flex avatar sits on the text
      // baseline of any surrounding line box, whose descender space then grows
      // the avatar's container taller than wide. A ring or outline wrapped
      // around that container becomes an ellipse that dips below the picture.
      // As a block flex container the avatar never participates in a line box,
      // so its box stays exactly square.
      "relative flex shrink-0 items-center justify-center overflow-hidden rounded-full",
      AVATAR_SIZE[size],
      className
    )}
  >
    {isSafeAvatarSrc(image) ? (
      <img
        alt={decorative ? "" : `${name}'s avatar`}
        aria-hidden={decorative || undefined}
        className="size-full object-cover"
        loading="lazy"
        // The picture may be hosted elsewhere, and a referrer would tell that host
        // which profile page a visitor was reading.
        referrerPolicy="no-referrer"
        src={image ?? undefined}
      />
    ) : (
      <span
        aria-hidden="true"
        className="bg-primary text-primary-foreground flex size-full items-center justify-center font-semibold"
      >
        {initialOf(name)}
      </span>
    )}
  </span>
);

export { Avatar };
