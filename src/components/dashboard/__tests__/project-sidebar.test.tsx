import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  ProjectMobileNav,
  ProjectSidebar,
} from "@/components/dashboard/project-sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { ProjectTab } from "@/lib/project-tabs";

const baseProps = {
  // SAFETY: "details" is one of the four values in the ProjectTab union.
  activeTab: "details" as ProjectTab,
  hasVersions: true,
  onSelect: vi.fn<(tab: ProjectTab) => void>(),
  versionCount: 3,
};

const renderSidebar = (props = baseProps) =>
  render(
    <TooltipProvider>
      <ProjectSidebar {...props} />
    </TooltipProvider>
  );

describe(ProjectSidebar, () => {
  it("groups the editor sections and marks the active one", () => {
    renderSidebar();

    const nav = screen.getByRole("navigation", { name: "Project sections" });
    expect(within(nav).getByText("Project")).toBeInTheDocument();
    expect(
      within(nav).getByRole("button", { name: /Danger Zone/u })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Details/u })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(
      screen.getByRole("button", { name: /Versions\s*3\s*versions/u })
    ).toBeInTheDocument();
  });

  it("selects a section through the callback", () => {
    const onSelect = vi.fn<(tab: ProjectTab) => void>();
    renderSidebar({ ...baseProps, onSelect });

    fireEvent.click(screen.getByRole("button", { name: /Images/u }));

    expect(onSelect).toHaveBeenCalledWith("images");
  });

  it("calls the release section Server for projects without versions", () => {
    renderSidebar({ ...baseProps, hasVersions: false, versionCount: 0 });

    expect(screen.getByRole("button", { name: /Server/u })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Versions/u })).toBeNull();
  });

  it("offers the same sections in the mobile drawer", async () => {
    const onSelect = vi.fn<(tab: ProjectTab) => void>();
    render(
      <TooltipProvider>
        <ProjectMobileNav {...baseProps} onSelect={onSelect} />
      </TooltipProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: /Sections/u }));

    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /Images/u }));

    expect(onSelect).toHaveBeenCalledWith("images");
  });
});
