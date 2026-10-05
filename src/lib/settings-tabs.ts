import { object, optional, parse, picklist } from "valibot";

/**
 * The settings tabs, and how a URL turns into one of them.
 *
 * Extracted from `src/routes/settings.tsx` for the same reason as
 * `src/lib/admin-tabs.ts`: the routing policy is the part with the interesting
 * failure modes, and it cannot be tested from inside the route file. Importing
 * the route evaluates `getSession`, which reaches `@/db` and its `DATABASE_URL`,
 * so a test that pulled it in would die before reaching a single assertion.
 */

/**
 * The tabs that have a trigger, in display order.
 *
 * `resolveTab` must only ever return one of these values. Returning anything
 * else renders a tab list where nothing is selected and every panel is hidden,
 * which is a blank-looking page rather than an error — the kind of failure that
 * ships. The legacy `passkeys` alias is the reason this is worth asserting
 * separately: it is a name the schema accepts that is deliberately not a tab.
 */
export const SETTINGS_TABS = [
  { label: "Profile", value: "profile" },
  { label: "Security", value: "security" },
  { label: "Sessions", value: "sessions" },
  { label: "Danger Zone", value: "danger" },
] as const;

export type SettingsTab = (typeof SETTINGS_TABS)[number]["value"];

/**
 * Tab names accepted in the URL, which is a superset of the tabs.
 *
 * `passkeys` is the former name of the Security tab. It is kept so links that
 * predate the rename still land on the right panel; `resolveTab` folds it into
 * `security` rather than it being a tab in its own right.
 *
 * `as const` is what makes `picklist` narrow: without it the schema accepts any
 * string and `resolveTab` stops being able to promise a real tab.
 */
const URL_TAB_NAMES = [
  "profile",
  "security",
  "passkeys",
  "sessions",
  "danger",
] as const;

const LEGACY_TAB_ALIAS = "passkeys";

/** The value that marks a return from the deletion re-authentication round trip. */
export const DELETE_CONFIRM = "delete";

const settingsSearchSchema = object({
  confirm: optional(picklist([DELETE_CONFIRM])),
  tab: optional(picklist(URL_TAB_NAMES)),
});

export const parseSettingsSearch = (
  search: Record<string, string | undefined>
) => parse(settingsSearchSchema, search);

export type SettingsSearch = ReturnType<typeof parseSettingsSearch>;

/**
 * The tab to render.
 *
 * Three inputs, in this order:
 *
 * 1. The legacy `passkeys` alias, folded into the tab it was renamed to.
 * 2. An explicit `tab`, so a shared or bookmarked link lands where it was aimed.
 * 3. Otherwise `confirm=delete` — the return from re-authenticating to delete
 *    an account — which lands on the Danger Zone, and everything else on
 *    Profile.
 *
 * Note that `confirm` is only consulted when `tab` is absent. `REAUTH_CALLBACK_URL`
 * always sends both, so the app never hits the disagreement, but a hand-edited
 * or stale bookmark of `/settings?tab=profile&confirm=delete` resolves to
 * `profile` while the Danger Zone would still be told to resume — and because
 * hidden tab panels unmount, the resume cannot fire until that tab is clicked.
 * `settings-tabs.test.ts` pins this so the behaviour is a decision rather than
 * an accident.
 */
export const resolveTab = ({ confirm, tab }: SettingsSearch): SettingsTab => {
  if (tab === LEGACY_TAB_ALIAS) {
    return "security";
  }
  if (tab) {
    return tab;
  }
  return confirm === DELETE_CONFIRM ? "danger" : "profile";
};
