import { object, optional, parse, picklist } from "valibot";

/**
 * The URL policy for the project editor, extracted from the route so it can be
 * tested without loading `getEditableProject` (which reaches Postgres).
 */

/** The sections that have a panel, in sidebar order. */
export const PROJECT_TABS = [
  { label: "Details", value: "details" },
  { label: "Images", value: "images" },
  { label: "Versions", value: "versions" },
  { label: "Danger Zone", value: "danger" },
] as const;

export type ProjectTab = (typeof PROJECT_TABS)[number]["value"];

const URL_TAB_NAMES = ["details", "images", "versions", "danger"] as const;

const projectSearchSchema = object({
  tab: optional(picklist(URL_TAB_NAMES)),
});

export const parseProjectSearch = (
  search: Record<string, string | undefined>
) => parse(projectSearchSchema, search);

export type ProjectSearch = ReturnType<typeof parseProjectSearch>;

/** Unknown and absent tabs both land on Details, the editor's entry point. */
export const resolveProjectTab = ({ tab }: ProjectSearch): ProjectTab =>
  tab ?? "details";
