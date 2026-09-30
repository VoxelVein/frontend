import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ProjectForm } from "@/components/dashboard/project-form";
import type { ProjectInput } from "@/lib/projects";

// oxlint-disable-next-line anti-slop/no-module-mocking, vitest/prefer-import-in-mock -- Links need a router instance; a plain anchor keeps the test on the form
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => (
    <a href="/">{children}</a>
  ),
}));

const onSubmit = vi.fn<(input: ProjectInput) => Promise<void>>(() =>
  Promise.resolve()
);

const renderForm = () =>
  render(
    <ProjectForm
      mode="edit"
      submitLabel="Save changes"
      initialValues={{
        category: "optimization",
        description: "# Heading\n\nSome **bold** text.",
        name: "Sodium",
        slug: "sodium",
        summary: "Makes the game go faster.",
        tags: "",
        type: "mod",
      }}
      onSubmit={onSubmit}
    />
  );

describe("project description preview", () => {
  it("starts hidden, so the form is not taller than it needs to be", () => {
    renderForm();

    expect(screen.getByRole("button", { name: "Preview" })).toHaveAttribute(
      "aria-expanded",
      "false"
    );
    expect(screen.queryByText("Description preview")).toBeNull();
  });

  it("shows the rendered description when toggled", () => {
    renderForm();

    fireEvent.click(screen.getByRole("button", { name: "Preview" }));

    expect(screen.getByText("Description preview")).toBeTruthy();
    // Rendered Markdown, not the raw source, which is the point of the preview.
    expect(screen.getByRole("heading", { name: "Heading" })).toBeTruthy();
    expect(screen.getByText("bold").tagName).toBe("STRONG");
  });

  it("toggles back closed", () => {
    renderForm();

    fireEvent.click(screen.getByRole("button", { name: "Preview" }));
    fireEvent.click(screen.getByRole("button", { name: "Hide preview" }));

    expect(screen.queryByText("Description preview")).toBeNull();
    expect(screen.getByRole("button", { name: "Preview" })).toHaveAttribute(
      "aria-expanded",
      "false"
    );
  });

  it("explains an empty description instead of rendering a blank box", () => {
    render(
      <ProjectForm
        mode="edit"
        submitLabel="Save changes"
        initialValues={{
          category: "optimization",
          description: "   ",
          name: "Sodium",
          slug: "sodium",
          summary: "Makes the game go faster.",
          tags: "",
          type: "mod",
        }}
        onSubmit={onSubmit}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Preview" }));

    expect(screen.getByText("Nothing to preview yet.")).toBeTruthy();
  });

  it("points aria-controls at the element it toggles", () => {
    renderForm();

    const toggle = screen.getByRole("button", { name: "Preview" });
    const controls = toggle.getAttribute("aria-controls");

    expect(controls).toBeTruthy();
    fireEvent.click(toggle);
    expect(
      document.querySelector(`#${CSS.escape(String(controls))}`)
    ).toBeTruthy();
  });

  it("caps the width of the form, so every field inherits it", () => {
    const { container } = renderForm();

    // Capped on the form rather than per field, so a field added later cannot
    // forget the constraint and stretch across the whole column.
    expect(container.querySelector("form")?.className).toContain("max-w-2xl");
  });
});
