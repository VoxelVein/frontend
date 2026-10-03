import { describe, expect, it } from "vitest";

import {
  notificationGroup,
  notificationGroupLabel,
  presentationFor,
  USER_NOTIFICATION_TYPES,
} from "@/lib/notifications";
import type { NotificationGroup } from "@/lib/notifications";

/** Every group, so the label test cannot pass while a group is unnamed. */
const ALL_GROUPS: readonly NotificationGroup[] = [
  "earlier",
  "today",
  "yesterday",
];

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** A local timestamp the given number of milliseconds before `now`. */
const before = (now: number, ms: number): string =>
  new Date(now - ms).toISOString();

describe(notificationGroup, () => {
  const now = Date.parse("2026-09-27T12:00:00.000Z");

  it("puts anything from today in today", () => {
    expect(notificationGroup(before(now, 2 * HOUR), now)).toBe("today");
    expect(notificationGroup(before(now, 0), now)).toBe("today");
  });

  it("puts last night in yesterday, not the day before", () => {
    // Measured against whole local days, not 24 hours ago: read at 9am, an 11pm
    // notification is yesterday, and a sliding 24-hour window would file it
    // under "Earlier" and then move it back as the day wore on.
    expect(notificationGroup(before(now, 20 * HOUR), now)).toBe("yesterday");
  });

  it("puts anything older in earlier", () => {
    expect(notificationGroup(before(now, 3 * DAY), now)).toBe("earlier");
    expect(notificationGroup(before(now, 30 * DAY), now)).toBe("earlier");
  });

  it("does not treat a future timestamp as anything but today", () => {
    // Clock skew between the server writing the row and the browser reading it
    // would otherwise file the newest notification under "Earlier".
    expect(notificationGroup(new Date(now + HOUR).toISOString(), now)).toBe(
      "today"
    );
  });
});

describe(notificationGroupLabel, () => {
  it("names each group the way a reader thinks about it", () => {
    const labels: Record<NotificationGroup, string> = {
      earlier: "Earlier",
      today: "Today",
      yesterday: "Yesterday",
    };

    for (const group of ALL_GROUPS) {
      expect(notificationGroupLabel(group)).toBe(labels[group]);
    }
  });
});

describe(presentationFor, () => {
  it("gives every kind a headline and a tone", () => {
    for (const type of USER_NOTIFICATION_TYPES) {
      const { headline, tone } = presentationFor(type);

      expect(headline.length).toBeGreaterThan(0);
      expect(["attention", "neutral", "positive"]).toContain(tone);
    }
  });

  it("does not give approval and rejection the same tone", () => {
    // The row's background and icon come from the tone, so sharing one would
    // make the two outcomes look identical at a glance — which is the exact
    // moment a reader most needs to tell them apart.
    expect(presentationFor("project-approved").tone).not.toBe(
      presentationFor("project-rejected").tone
    );
  });

  it("separates a report actioned from a report dismissed", () => {
    expect(presentationFor("report-resolved").tone).not.toBe(
      presentationFor("report-dismissed").tone
    );
  });

  it("falls back for a kind this version does not know", () => {
    // A row written by a newer deploy should still render with a plain icon,
    // not blank the panel out because this build recognises no kind in it.
    // `presentationFor` takes what the database actually holds rather than
    // demanding the union, so that case is reachable rather than asserted away.
    const fallback = presentationFor("invented-kind");

    expect(fallback.tone).toBe("neutral");
    expect(fallback.headline.length).toBeGreaterThan(0);
  });
});
