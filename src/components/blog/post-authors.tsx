import { Link } from "@tanstack/react-router";

import { Avatar } from "@/components/avatar";
import { formatAuthorNames } from "@/lib/posts";
import type { PostAuthor } from "@/lib/posts";

interface PostAuthorsProps {
  authors: PostAuthor[];
  /** Renders the smaller byline used on cards, where space is tight. */
  compact?: boolean;
  /**
   * Whether each author links to their profile.
   *
   * Off inside a post card, because the card's own link is stretched over the
   * whole tile: a profile link underneath it would be unreachable by pointer and
   * ambiguous to a screen reader, which would then report a link inside a link.
   * The card offers exactly one destination, and the names are read as part of
   * the byline rather than as separate links.
   */
  linked?: boolean;
}

/**
 * Who wrote a post: their pictures, then their names.
 *
 * One list rather than a sentence, so each author is a separate item a screen
 * reader can count. The names are also joined into a single line for reading
 * order, because a byline is one fact about the post, not several.
 *
 * A post with no recorded author renders nothing at all rather than a
 * placeholder: an empty byline is a bug in the data, and a visible "Unknown
 * author" would put that on every affected page forever without saying who
 * should fix it.
 */
const PostAuthors = ({
  authors,
  compact = false,
  linked = true,
}: PostAuthorsProps) => {
  if (authors.length === 0) {
    return null;
  }

  const summary = formatAuthorNames(authors);

  return (
    <div className="flex items-center gap-3">
      <ul aria-label="Authors" className="flex -space-x-2">
        {authors.map((author) => (
          // The background ring separates overlapping pictures, so it is always
          // on rather than appearing on hover. It was previously a ring *offset*,
          // which painted a background-coloured disc around whichever avatar was
          // hovered — read as stray circles sitting behind it, and clipped into
          // arcs by the neighbouring avatars. An offset has no place on a picture
          // that sits flush against its neighbours.
          <li
            className="ring-background relative rounded-full ring-2"
            key={author.id}
          >
            {linked && author.username ? (
              <Link
                // Lifted above the overlapping neighbours so the hover and focus
                // states are never occluded by the next avatar along.
                className="focus-visible:ring-ring relative block rounded-full transition-opacity hover:z-10 hover:opacity-90 focus-visible:z-10 focus-visible:ring-2 focus-visible:outline-none"
                to="/u/$username"
                params={{ username: author.username }}
              >
                <Avatar image={author.image} name={author.name} size="sm" />
                <span className="sr-only">{author.name}</span>
              </Link>
            ) : (
              <Avatar image={author.image} name={author.name} size="sm" />
            )}
          </li>
        ))}
      </ul>

      {/* The same names again, as prose. The avatar list above carries the
          pictures; this carries the fact of who wrote it. */}
      <p className="text-muted-foreground min-w-0 truncate text-sm">
        {compact ? summary : `By ${summary}`}
      </p>
    </div>
  );
};

export { PostAuthors };
