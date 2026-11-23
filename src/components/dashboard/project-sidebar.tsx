import {
  IconFileText,
  IconPhoto,
  IconServer,
  IconTrash,
  IconVersions,
} from "@tabler/icons-react";

import { AppSidebar, AppSidebarDrawer } from "@/components/app-sidebar";
import type { SidebarSection } from "@/components/app-sidebar";
import type { ProjectTab } from "@/lib/project-tabs";

interface ProjectSidebarProps {
  activeTab: ProjectTab;
  hasVersions: boolean;
  onSelect: (tab: ProjectTab) => void;
  versionCount: number;
}

/**
 * The editor's sections, grouped by what a creator is doing. The Versions
 * entry becomes Server for project types that have no versions, matching the
 * panel that is actually rendered for them.
 */
const resolveSections = ({
  hasVersions,
  versionCount,
}: ProjectSidebarProps): readonly SidebarSection<ProjectTab>[] => [
  {
    heading: "Project",
    entries: [
      {
        icon: <IconFileText size={18} aria-hidden="true" />,
        label: "Details",
        value: "details",
      },
      {
        icon: <IconPhoto size={18} aria-hidden="true" />,
        label: "Images",
        value: "images",
      },
      {
        count: hasVersions ? versionCount : 0,
        icon: hasVersions ? (
          <IconVersions size={18} aria-hidden="true" />
        ) : (
          <IconServer size={18} aria-hidden="true" />
        ),
        label: hasVersions ? "Versions" : "Server",
        suffix: hasVersions ? "versions" : "",
        value: "versions",
      },
    ],
  },
  {
    heading: "Danger Zone",
    entries: [
      {
        icon: <IconTrash size={18} aria-hidden="true" />,
        label: "Danger Zone",
        value: "danger",
      },
    ],
  },
];

export const ProjectSidebar = (props: ProjectSidebarProps) => (
  <AppSidebar<ProjectTab>
    activeValue={props.activeTab}
    collapseAriaLabel="Collapse project navigation"
    expandAriaLabel="Expand project navigation"
    navLabel="Project sections"
    onSelect={props.onSelect}
    sections={resolveSections(props)}
    subtitle="Manage this project"
    title="Project"
  />
);

/** The same navigation in a drawer, for screens below the sidebar breakpoint. */
export const ProjectMobileNav = (props: ProjectSidebarProps) => (
  <AppSidebarDrawer<ProjectTab>
    activeValue={props.activeTab}
    navLabel="Project sections"
    onSelect={props.onSelect}
    sections={resolveSections(props)}
    sheetDescription="Switch between the parts of this project you can manage."
    sheetTitle="Project sections"
    triggerLabel="Sections"
  />
);
