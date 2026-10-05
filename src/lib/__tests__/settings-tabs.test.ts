import { describe, expect, it } from "vitest";

import {
  DELETE_CONFIRM,
  parseSettingsSearch,
  resolveTab,
  SETTINGS_TABS,
} from "@/lib/settings-tabs";

/**
 * The settings tabs are pure URL policy, and the three inputs that feed them can
 * disagree. Each case below is a URL somebody can actually paste into the
 * address bar.
 */

const tabValues = SETTINGS_TABS.map(({ value }) => value);

/** Parses a real query string rather than hand-building the parsed shape. */
const search = (query: string) =>
  parseSettingsSearch(Object.fromEntries(new URLSearchParams(query)));

describe(resolveTab, () => {
  it("lands on Profile with no parameters at all", () => {
    expect(resolveTab(search(""))).toBe("profile");
  });

  it("honours an explicit tab", () => {
    for (const { value } of SETTINGS_TABS) {
      expect(resolveTab(search(`tab=${value}`))).toBe(value);
    }
  });

  it("folds the legacy passkeys alias into the Security tab", () => {
    // The tab was renamed; links that predate it are still in bookmarks,
    // search results, and chat logs. Resolving to "passkeys" would select no
    // trigger at all, because the URL accepts that name but no tab has it.
    expect(resolveTab(search("tab=passkeys"))).toBe("security");
  });

  it("opens the Danger Zone for the deletion re-authentication return", () => {
    // What `REAUTH_CALLBACK_URL` sends back to the app.
    expect(resolveTab(search(`tab=danger&confirm=${DELETE_CONFIRM}`))).toBe(
      "danger"
    );
    // And the same flag on its own, for a link that dropped the tab.
    expect(resolveTab(search(`confirm=${DELETE_CONFIRM}`))).toBe("danger");
  });

  it("lets an explicit tab win over the deletion flag", () => {
    // `confirm` is only read when `tab` is absent. The consequences are pinned
    // in the next test; this one just records the precedence.
    expect(resolveTab(search(`tab=security&confirm=${DELETE_CONFIRM}`))).toBe(
      "security"
    );
    expect(resolveTab(search(`tab=passkeys&confirm=${DELETE_CONFIRM}`))).toBe(
      "security"
    );
  });

  it("only ever resolves to a tab that has a trigger", () => {
    // The failure this guards: a name the schema accepts but no tab renders.
    // Nothing is selected, every panel is hidden, and the page looks broken
    // rather than reporting an error.
    const fromEveryUrlName = [
      ...["profile", "security", "passkeys", "sessions", "danger"].map((name) =>
        resolveTab(search(`tab=${name}`))
      ),
      resolveTab(search(`confirm=${DELETE_CONFIRM}`)),
      resolveTab(search("")),
    ];

    for (const resolved of fromEveryUrlName) {
      expect(tabValues).toContain(resolved);
    }
  });
});

describe("a tab and the deletion flag that disagree", () => {
  /**
   * `resolveTab` reads `confirm` only when `tab` is absent, but the Danger Zone
   * reads it unconditionally as its `resumeDeletion` prop. A bookmark of
   * `/settings?tab=profile&confirm=delete` therefore lands on Profile while the
   * deletion wizard is still armed.
   *
   * Nothing breaks outright, and it is not reachable from the app — the only
   * writer of `confirm=delete` is `REAUTH_CALLBACK_URL`, which always sends
   * `tab=danger` with it. But Base UI's `Tabs.Panel` defaults `keepMounted` to
   * false, so the Danger Zone is not in the tree while Profile is showing: the
   * resume cannot fire until the person clicks the tab themselves, at which
   * point it fires and clears the flag. Recoverable, but only by a click that
   * has no visible reason to exist.
   *
   * Asserted here so the behaviour is a recorded decision. If `resolveTab` ever
   * starts honouring `confirm` alongside `tab`, this test is the place to
   * update.
   */
  const conflicting = `tab=profile&confirm=${DELETE_CONFIRM}`;

  it("resolves to the tab that was asked for", () => {
    expect(resolveTab(search(conflicting))).toBe("profile");
  });

  it("leaves the deletion wizard armed on a tab that is not showing", () => {
    const parsed = search(conflicting);

    expect(resolveTab(parsed)).not.toBe("danger");
    // The prop the Danger Zone would receive, which is only read once that
    // panel is actually mounted.
    expect(parsed.confirm).toBe(DELETE_CONFIRM);
  });
});

describe(parseSettingsSearch, () => {
  it("defaults both fields to absent", () => {
    expect(search("")).toStrictEqual({});
  });

  it("rejects a tab name that is not a tab", () => {
    // Not a fallback: the route's `validateSearch` throws on it, which is how
    // an unknown value becomes a visible router error instead of a blank page.
    expect(() => search("tab=admin")).toThrow(/received "admin"/u);
    expect(() => search("tab=")).toThrow(/received ""/u);
  });

  it("rejects a confirm value that is not the deletion one", () => {
    expect(() => search("confirm=delete-everything")).toThrow(
      /received "delete-everything"/u
    );
  });
});
