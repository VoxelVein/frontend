import { describe, expect, it } from "vitest";

import {
  getNextUsernameChange,
  getUsernameProblem,
  isReservedUsername,
  normalizeUsername,
  toUsernameBase,
  USERNAME_CHANGE_COOLDOWN_MS,
  USERNAME_MAX_LENGTH,
  withUsernameSuffix,
} from "@/lib/usernames";

const NOW = new Date("2026-09-26T12:00:00.000Z");
const DAY_IN_MS = 24 * 60 * 60 * 1000;

describe(normalizeUsername, () => {
  it("trims and lowercases", () => {
    expect(normalizeUsername("  Steve.Builds ")).toBe("steve.builds");
  });
});

describe(isReservedUsername, () => {
  it("matches reserved names regardless of case", () => {
    expect(isReservedUsername("Admin")).toBeTruthy();
    expect(isReservedUsername("welcome")).toBeTruthy();
    expect(isReservedUsername("steve")).toBeFalsy();
  });
});

describe(toUsernameBase, () => {
  it("replaces invalid characters and lowercases", () => {
    expect(toUsernameBase("Steve Builds!")).toBe("steve_builds");
  });

  it("strips leading and trailing separators", () => {
    expect(toUsernameBase("__.steve._")).toBe("steve");
  });

  it("caps the length", () => {
    expect(toUsernameBase("a".repeat(50))).toHaveLength(USERNAME_MAX_LENGTH);
  });

  it("falls back to user for short input", () => {
    expect(toUsernameBase("ab")).toBe("user");
    expect(toUsernameBase("")).toBe("user");
    expect(toUsernameBase("!!!")).toBe("user");
  });

  it("falls back to user for reserved names", () => {
    expect(toUsernameBase("Admin")).toBe("user");
    expect(toUsernameBase("dashboard")).toBe("user");
  });
});

describe(withUsernameSuffix, () => {
  it("appends the suffix", () => {
    expect(withUsernameSuffix("steve", "42")).toBe("steve_42");
  });

  it("keeps the result within the maximum length", () => {
    const result = withUsernameSuffix("a".repeat(USERNAME_MAX_LENGTH), "1234");

    expect(result).toHaveLength(USERNAME_MAX_LENGTH);
    expect(result.endsWith("_1234")).toBeTruthy();
  });
});

describe(getUsernameProblem, () => {
  it("accepts a valid username", () => {
    expect(getUsernameProblem("steve.builds_1")).toBeNull();
  });

  it("reports too short and too long names", () => {
    expect(getUsernameProblem("ab")).toBe("too-short");
    expect(getUsernameProblem("  ab  ")).toBe("too-short");
    expect(getUsernameProblem("a".repeat(USERNAME_MAX_LENGTH + 1))).toBe(
      "too-long"
    );
  });

  it("reports invalid characters", () => {
    expect(getUsernameProblem("steve builds")).toBe("invalid");
    expect(getUsernameProblem("steve-builds")).toBe("invalid");
  });

  it("reports reserved names", () => {
    expect(getUsernameProblem("Settings")).toBe("reserved");
  });
});

describe(getNextUsernameChange, () => {
  it("returns null when the username was never changed", () => {
    expect(getNextUsernameChange(null, NOW)).toBeNull();
    expect(getNextUsernameChange(undefined, NOW)).toBeNull();
  });

  it("returns the end of the cooldown while it is running", () => {
    const changedAt = new Date(NOW.getTime() - DAY_IN_MS);

    expect(getNextUsernameChange(changedAt, NOW)).toStrictEqual(
      new Date(changedAt.getTime() + USERNAME_CHANGE_COOLDOWN_MS)
    );
  });

  it("accepts ISO strings", () => {
    const changedAt = new Date(NOW.getTime() - DAY_IN_MS).toISOString();

    expect(getNextUsernameChange(changedAt, NOW)).not.toBeNull();
  });

  it("returns null once the cooldown has passed", () => {
    const changedAt = new Date(
      NOW.getTime() - USERNAME_CHANGE_COOLDOWN_MS - DAY_IN_MS
    );

    expect(getNextUsernameChange(changedAt, NOW)).toBeNull();
  });

  it("locks right up to the last millisecond of the cooldown", () => {
    // The boundary the other two tests straddle but never sit on. The guard is
    // `next > now`, so one millisecond before the end is still locked, the end
    // itself is free, and after it is free. An off-by-one here would either
    // lock someone out for a millisecond or let them rename one early, which
    // is the difference between the stated rule and a different one.
    const changedAt = new Date(NOW.getTime() - USERNAME_CHANGE_COOLDOWN_MS);
    const oneMsEarly = new Date(NOW.getTime() - 1);

    expect(getNextUsernameChange(changedAt, oneMsEarly)).toStrictEqual(NOW);
    expect(getNextUsernameChange(changedAt, NOW)).toBeNull();
    expect(
      getNextUsernameChange(changedAt, new Date(NOW.getTime() + 1))
    ).toBeNull();
  });

  it("does not read a malformed timestamp as a live cooldown", () => {
    // `new Date("not a date").getTime()` is NaN, so `next` is an Invalid Date
    // and every comparison against it is false. That yields null — the account
    // is treated as renameable — rather than a thrown error on a settings page.
    expect(getNextUsernameChange("not a date", NOW)).toBeNull();
  });
});
