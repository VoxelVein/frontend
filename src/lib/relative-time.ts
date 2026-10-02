const relativeFormatter = new Intl.RelativeTimeFormat(undefined, {
  numeric: "auto",
});

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;
const SECONDS_PER_DAY = 86_400;
const MS_PER_SECOND = 1000;

/**
 * A timestamp as a relative phrase: "3 hours ago", "in 2 days".
 *
 * Shared by the admin inbox and the sessions panel, which both show "when" for
 * a row and would otherwise keep two copies of the same thresholds.
 *
 * `now` is passed in rather than read from the clock so a list renders every
 * row against one instant — otherwise rows computed either side of a second
 * boundary disagree with each other.
 */
export const relativeTime = (
  value: Date | string,
  now: number = Date.now()
): string => {
  const seconds = Math.round((new Date(value).getTime() - now) / MS_PER_SECOND);
  const magnitude = Math.abs(seconds);

  if (magnitude < SECONDS_PER_MINUTE) {
    return relativeFormatter.format(seconds, "second");
  }
  if (magnitude < SECONDS_PER_HOUR) {
    return relativeFormatter.format(
      Math.round(seconds / SECONDS_PER_MINUTE),
      "minute"
    );
  }
  if (magnitude < SECONDS_PER_DAY) {
    return relativeFormatter.format(
      Math.round(seconds / SECONDS_PER_HOUR),
      "hour"
    );
  }
  return relativeFormatter.format(Math.round(seconds / SECONDS_PER_DAY), "day");
};
