import { IconSearch, IconX } from "@tabler/icons-react";

interface PostSearchBarProps {
  /** Names the field for assistive tech, e.g. "Search blog posts". */
  label: string;
  onQueryChange: (value: string) => void;
  placeholder: string;
  query: string;
}

/**
 * Search input for the blog listing and the admin Posts tab.
 *
 * Only rendered once search is known to be working, so it never offers a field
 * that cannot do anything.
 */
const PostSearchBar = ({
  label,
  onQueryChange,
  placeholder,
  query,
}: PostSearchBarProps) => (
  <div className="relative mt-8">
    <IconSearch
      size={18}
      stroke={1.8}
      aria-hidden="true"
      className="text-muted-foreground pointer-events-none absolute top-1/2 left-4 -translate-y-1/2"
    />
    <label className="sr-only" htmlFor="post-search">
      {label}
    </label>
    <input
      id="post-search"
      name="query"
      type="search"
      value={query}
      onChange={(event) => onQueryChange(event.target.value)}
      placeholder={placeholder}
      autoComplete="off"
      className="border-border bg-muted/40 text-foreground placeholder:text-muted-foreground focus-visible:ring-ring focus:bg-background min-h-12 w-full rounded-xl border pr-12 pl-11 text-base transition-colors focus-visible:ring-2 focus-visible:outline-none"
    />
    {query ? (
      <button
        type="button"
        onClick={() => onQueryChange("")}
        aria-label="Clear search"
        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring absolute top-1/2 right-2 flex size-11 -translate-y-1/2 items-center justify-center rounded-lg focus-visible:ring-2 focus-visible:outline-none"
      >
        <IconX size={16} aria-hidden="true" />
      </button>
    ) : null}
  </div>
);

export { PostSearchBar };
