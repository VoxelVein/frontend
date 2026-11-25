import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ProjectBrowserFilters } from "@/components/projects/project-browser-filters";
import type { ProjectBrowserFiltersProps } from "@/components/projects/project-browser-filters";
import { DEFAULT_SORT } from "@/lib/project-browser";

const renderFilters = (overrides: Partial<ProjectBrowserFiltersProps> = {}) => {
  const props: ProjectBrowserFiltersProps = {
    category: "",
    categories: ["performance"],
    clientRequirement: "",
    filterCount: 0,
    gameVersion: "",
    hasFilters: false,
    loader: "",
    onCategoryChange: vi.fn<(value: string | null) => void>(),
    onClearFilters: vi.fn<() => void>(),
    onClientRequirementChange: vi.fn<(value: string | null) => void>(),
    onGameVersionChange: vi.fn<(value: string | null) => void>(),
    onLoaderChange: vi.fn<(value: string | null) => void>(),
    onQueryChange: vi.fn<(value: string) => void>(),
    onSortChange: vi.fn<(value: string | null) => void>(),
    query: "",
    sort: DEFAULT_SORT,
    type: "mod",
    ...overrides,
  };

  return { props, ...render(<ProjectBrowserFilters {...props} />) };
};

describe(ProjectBrowserFilters, () => {
  it("introduces the panel with a hint for the current type", () => {
    renderFilters();

    expect(
      screen.getByRole("heading", { name: "Find a project" })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Search mods by name, category, game version and loader."
      )
    ).toBeInTheDocument();
  });

  it("keeps reset controls out of an untouched panel", () => {
    renderFilters();

    expect(
      screen.queryByRole("button", { name: /reset filters/iu })
    ).toBeNull();
  });

  it("shows how many filters are active and resets them", () => {
    const { props } = renderFilters({
      category: "performance",
      filterCount: 2,
      hasFilters: true,
      query: "sodium",
    });

    expect(screen.getByText("2")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /reset filters/iu }));

    expect(props.onClearFilters).toHaveBeenCalledOnce();
  });

  it("reports typing and clears the search field", () => {
    const { props } = renderFilters({ query: "sodium" });

    fireEvent.change(screen.getByLabelText("Search mods"), {
      target: { value: "fabric" },
    });
    expect(props.onQueryChange).toHaveBeenCalledWith("fabric");

    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(props.onQueryChange).toHaveBeenCalledWith("");
  });

  it("shows a loader field only for types that have loaders", () => {
    const { props, rerender } = renderFilters({ type: "datapack" });

    expect(screen.queryByLabelText("Loader")).toBeNull();
    expect(screen.getByLabelText("Game version")).toBeInTheDocument();

    rerender(<ProjectBrowserFilters {...props} type="plugin" />);
    expect(screen.getByLabelText("Platform")).toBeInTheDocument();
  });
});
