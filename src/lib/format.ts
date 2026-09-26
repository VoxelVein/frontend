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
