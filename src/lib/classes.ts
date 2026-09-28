/**
 * Class strings shared by more than one component.
 *
 * Only patterns that are genuinely repeated across unrelated files live here.
 * A constant earns its place when a change to it has to reach several places at
 * once and a missed one is a silent inconsistency, not a local edit. Anything
 * used by a single component stays inline, where it can be read next to the
 * markup it styles.
 *
 * Import the constant and compose it with `cn` when a caller needs to add to
 * it, rather than editing the string at the call site.
 */

/**
 * The small uppercase label above a value — a date, a stat's name, a section
 * eyebrow. Used by the blog card, the blog post, the public project page, and
 * the stat tile, so the type treatment cannot drift between them.
 */
export const MICRO_LABEL_CLASS =
  "text-muted-foreground text-xs font-medium tracking-wide uppercase";
