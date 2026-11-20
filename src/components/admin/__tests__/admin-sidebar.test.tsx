import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AdminMobileNav, AdminSidebar } from "@/components/admin/admin-sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { AdminTab } from "@/lib/admin-tabs";

const TABS = [
  { label: "Users", value: "users" },
  { label: "Reviews", value: "reviews" },
  { label: "Reports", value: "reports" },
] as const satisfies readonly { label: string; value: AdminTab }[];

const COUNTS = { open: 2, pending: 1, unread: 0 };

const renderSidebar = (onSelectTab = vi.fn<(tab: AdminTab) => void>()) =>
  render(
    <TooltipProvider>
      <AdminSidebar
        activeTab="reviews"
        counts={COUNTS}
        onSelectTab={onSelectTab}
        tabs={TABS}
      />
    </TooltipProvider>
  );

describe(AdminSidebar, () => {
  it("groups the sections a role can actually see", () => {
    renderSidebar();

    expect(screen.getByText("People")).toBeInTheDocument();
    expect(screen.getByText("Moderation")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Users/u })).toBeInTheDocument();
    // Groups with nothing visible are omitted rather than left empty.
    expect(screen.queryByText("Content")).toBeNull();
    expect(screen.queryByRole("button", { name: /Posts/u })).toBeNull();
  });

  it("marks the current section for assistive technology", () => {
    renderSidebar();

    expect(screen.getByRole("button", { name: /Reviews/u })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(
      screen.getByRole("button", { name: /Reports/u })
    ).not.toHaveAttribute("aria-current");
  });

  it("keeps the existing count badges, with their meaning attached", () => {
    renderSidebar();

    expect(
      screen.getByRole("button", { name: /Reviews\s*1\s*pending/u })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Reports\s*2\s*open/u })
    ).toBeInTheDocument();
    // Zero counts stay out of the way.
    expect(
      screen.getByRole("button", { name: "Users" }).textContent
    ).not.toContain("0");
  });

  it("selects a section without changing the permission list", () => {
    const onSelectTab = vi.fn<(tab: AdminTab) => void>();
    renderSidebar(onSelectTab);

    fireEvent.click(screen.getByRole("button", { name: /Reports/u }));

    expect(onSelectTab).toHaveBeenCalledWith("reports");
  });

  it("collapses to icons and keeps the labels available by name", () => {
    renderSidebar();

    fireEvent.click(
      screen.getByRole("button", { name: "Collapse admin navigation" })
    );

    // Labels are gone from the visible row, so the button's accessible name
    // has to carry the section and its count instead.
    expect(
      screen.getByRole("button", { name: "Reviews, 1 pending" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Expand admin navigation" })
    ).toBeInTheDocument();
  });

  it("offers the same sections in a drawer on small screens", async () => {
    const onSelectTab = vi.fn<(tab: AdminTab) => void>();
    render(
      <TooltipProvider>
        <AdminMobileNav
          activeTab="reviews"
          counts={COUNTS}
          onSelectTab={onSelectTab}
          tabs={TABS}
        />
      </TooltipProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: /Sections/u }));

    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /Reports/u }));

    expect(onSelectTab).toHaveBeenCalledWith("reports");
  });
});
