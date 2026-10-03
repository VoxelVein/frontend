const countFormatter = new Intl.NumberFormat("en", {
  maximumFractionDigits: 1,
  notation: "compact",
});

const dateFormatter = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
  year: "numeric",
});

const BYTE_UNITS = ["B", "KB", "MB", "GB"] as const;
const BYTES_PER_UNIT = 1024;

/** 14200000 -> "14.2M" */
export const formatCount = (value: number): string =>
  countFormatter.format(value);

/**
 * Subcategories whose label is not just a capitalised word.
 *
 * `pvp` and `rpg` are the two that title-casing gets wrong — "Pvp" and "Rpg"
 * both read as typos, and they appear in the browse filter, the publish form,
 * and on every project card, so the mistake is everywhere at once.
 */
/**
 * A `Map`, not an object literal.
 *
 * `CATEGORY_LABELS[value]` on a plain object also matches `Object.prototype`
 * keys, so a category of `"constructor"` or `"toString"` returned the native
 * function instead of a label — a value typed as `string` that React then threw
 * on. `Map.get` looks only at its own entries, so any unknown slug simply
 * misses and falls through to the title-casing below.
 */
const CATEGORY_LABELS = new Map([
  ["pvp", "PvP"],
  ["rpg", "RPG"],
]);

/**
 * A stored category slug -> the label to show: "skyblock" -> "Skyblock".
 *
 * Every category is lowercase and dashed, so anything outside the acronym map
 * is just title-cased word by word. Every word is capitalised, not only the
 * first: capitalising the slug's leading character alone rendered
 * "kitchen-sink" as "Kitchen sink" and "world-management" as
 * "World management", both of which are real categories. An unknown slug still
 * produces something readable, since a project can carry a category this build
 * no longer lists.
 */
export const formatCategory = (value: string): string =>
  CATEGORY_LABELS.get(value) ??
  value
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

/** ISO timestamp -> "Aug 14, 2026" (UTC, so server and client agree). */
export const formatDate = (value: string): string =>
  dateFormatter.format(new Date(value));

/** 1536 -> "1.5 KB" */
export const formatBytes = (bytes: number): string => {
  let value = bytes;
  let unit = 0;
  while (value >= BYTES_PER_UNIT && unit < BYTE_UNITS.length - 1) {
    value /= BYTES_PER_UNIT;
    unit += 1;
  }
  const digits = unit === 0 || value >= 10 ? 0 : 1;
  return `${value.toFixed(digits)} ${BYTE_UNITS[unit]}`;
};
