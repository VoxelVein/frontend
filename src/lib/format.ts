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
const CATEGORY_LABELS = {
  pvp: "PvP",
  rpg: "RPG",
} as const satisfies Record<string, string>;

/**
 * A stored category slug -> the label to show: "skyblock" -> "Skyblock".
 *
 * Every category is lowercase and dashed, so anything outside the acronym map
 * is just title-cased with its dashes read as spaces. An unknown slug still
 * produces something readable, since a project can carry a category this build
 * no longer lists.
 */
export const formatCategory = (value: string): string => {
  // SAFETY: the lookup is a widening rather than a narrowing on purpose —
  // `value` is a plain string because categories come off a text column, and
  // the `in` guard is what makes it sound to read.
  const override: string | undefined =
    value in CATEGORY_LABELS
      ? CATEGORY_LABELS[value as keyof typeof CATEGORY_LABELS]
      : undefined;
  return (
    override ??
    value.charAt(0).toUpperCase() + value.slice(1).replaceAll("-", " ")
  );
};

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
