import { Avatar } from "@/components/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import type { SelectableAuthor } from "@/lib/posts";
import { ROLE_LABELS, isRole } from "@/lib/roles";

interface PostAuthorPickerProps {
  authors: SelectableAuthor[];
  disabled?: boolean;
  /** Rendered below the list and wired to it with `aria-describedby`. */
  error?: string;
  isLoading?: boolean;
  /**
   * Ids of the chosen authors, in byline order.
   *
   * Order is the contract: index 0 is the primary author and leads the byline.
   */
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

/**
 * Chooses which staff members a post is credited to.
 *
 * A checkbox list rather than a multi-select or a combobox: the set is every
 * admin and moderator, which is a short known list, so searching it would be
 * ceremony. Checkboxes also make the current selection state visible without
 * opening anything, which a token-style multi-select does not.
 *
 * Toggling sets the byline order — the first person ticked leads. Reordering
 * therefore means unticking and reticking, which is why the chosen ones are
 * numbered: without a visible order the editor cannot tell who leads.
 */
const PostAuthorPicker = ({
  authors,
  disabled = false,
  error,
  isLoading = false,
  onChange,
  selectedIds,
}: PostAuthorPickerProps) => {
  if (isLoading) {
    return (
      <div aria-busy="true" className="grid gap-2">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-11 w-full rounded-lg" />
        <Skeleton className="h-11 w-full rounded-lg" />
      </div>
    );
  }

  const toggle = (id: string, checked: boolean) => {
    onChange(
      checked ? [...selectedIds, id] : selectedIds.filter((each) => each !== id)
    );
  };

  return (
    <fieldset
      aria-describedby={error ? "post-authors-error" : undefined}
      aria-invalid={error ? true : undefined}
      className="grid gap-2"
      disabled={disabled}
    >
      <legend className="text-foreground text-sm font-medium">Authors</legend>

      <ul className="grid gap-1.5">
        {authors.map((author) => {
          const position = selectedIds.indexOf(author.id);

          return (
            <li key={author.id}>
              <label
                className="border-border bg-background hover:bg-muted/50 focus-within:ring-ring/50 flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 transition-colors focus-within:ring-3 focus-within:outline-none"
                htmlFor={`post-author-${author.id}`}
              >
                <Checkbox
                  checked={position !== -1}
                  id={`post-author-${author.id}`}
                  onCheckedChange={(checked) => toggle(author.id, checked)}
                />
                <Avatar image={author.image} name={author.name} size="sm" />
                <span className="text-foreground min-w-0 flex-1 truncate text-sm font-medium">
                  {author.name}
                </span>
                <span className="text-muted-foreground text-xs">
                  {isRole(author.role) ? ROLE_LABELS[author.role] : author.role}
                </span>
                {author.isCurrentUser ? (
                  // Explains why this account is ticked on a new post, instead of
                  // leaving the editor to wonder who chose them.
                  <span className="text-muted-foreground text-xs">You</span>
                ) : null}
                {position === -1 ? null : (
                  // The byline position. Explained by the list's helper text
                  // rather than a title, which a touch user never sees.
                  <span
                    aria-label={`Author ${position + 1} in the byline`}
                    className="bg-muted text-muted-foreground flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                  >
                    {position + 1}
                  </span>
                )}
              </label>
            </li>
          );
        })}
      </ul>

      <p className="text-muted-foreground text-xs">
        Only admins and moderators can be credited. The order chosen here is the
        order shown on the post.
      </p>

      {error ? (
        <p
          className="text-destructive text-sm"
          id="post-authors-error"
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </fieldset>
  );
};

export { PostAuthorPicker };
