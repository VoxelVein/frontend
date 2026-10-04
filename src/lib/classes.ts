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
 * The small uppercase label above a value (a date, a stat's name, a section
 * eyebrow. Used by the blog card, the blog post, the public project page, and
 * the stat tile, so the type treatment cannot drift between them.
 */
export const MICRO_LABEL_CLASS =
  "text-muted-foreground text-xs font-medium tracking-wide uppercase";

/**
 * A short factual value as a rounded chip: a Minecraft version, a mod loader, a
 * server platform.
 *
 * Used by the server page's supported-versions list and the download page's
 * compatibility list. Both answer the same question — "is this compatible with
 * what I have?" — by asking the reader to match a short string against something
 * on their own machine, so the two must render identically or one of them reads
 * as a different kind of fact.
 *
 * Monospaced because these are values copied into a launcher or typed into a
 * server address field, not prose.
 */
export const PILL_CLASS =
  "border-border bg-muted text-foreground inline-flex items-center rounded-full border px-3 py-1 font-mono text-sm";
