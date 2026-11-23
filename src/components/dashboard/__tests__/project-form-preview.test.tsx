import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

const renderForm = (mode: "create" | "edit" = "edit") =>
  render(
    <ProjectForm
      mode={mode}
      submitLabel="Save changes"
      initialValues={{
        category: "optimization",
        description: "# Heading\n\nSome **bold** text.",
        disclosures: [],
        name: "Sodium",
        slug: "sodium",
        summary: "Makes the game go faster.",
        tags: "",
        type: "mod",
      }}
      onSubmit={onSubmit}
    />
  );

describe("project description editor", () => {
  it("shows the rendered description without a toggle", () => {
    renderForm();

    // The preview is part of the layout rather than a mode: the whole point is
    // to see the Markdown while writing it.
    expect(screen.getByText("Preview")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Heading" })
    ).toBeInTheDocument();
    expect(screen.getByText("bold").tagName).toBe("STRONG");
  });

  it("updates the preview as the description changes", () => {
    renderForm();

    fireEvent.change(screen.getByLabelText("Description (Markdown)"), {
      target: { value: "Now with **fresh** words." },
    });

    expect(screen.getByText("fresh").tagName).toBe("STRONG");
    expect(screen.queryByRole("heading", { name: "Heading" })).toBeNull();
  });

  it("explains an empty description instead of rendering a blank box", () => {
    render(
      <ProjectForm
        mode="edit"
        submitLabel="Save changes"
        initialValues={{
          category: "optimization",
          description: "   ",
          disclosures: [],
          name: "Sodium",
          slug: "sodium",
          summary: "Makes the game go faster.",
          tags: "",
          type: "mod",
        }}
        onSubmit={onSubmit}
      />
    );

    expect(
      screen.getByText("Your description will appear here as you type.")
    ).toBeInTheDocument();
  });

  it("submits a disclosure with the description it needs", async () => {
    onSubmit.mockClear();
    renderForm();

    fireEvent.click(
      screen.getByRole("checkbox", { name: "AI-generated content" })
    );
    fireEvent.change(screen.getByLabelText("Describe ai-generated content"), {
      target: { value: "The icon art was generated with AI." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(onSubmit.mock.calls[0]?.[0].disclosures).toStrictEqual([
      {
        description: "The icon art was generated with AI.",
        type: "ai-generated",
      },
    ]);
  });

  it("puts the editor and preview in one row from large screens up", () => {
    renderForm();

    const textarea = screen.getByLabelText("Description (Markdown)");

    expect(textarea.closest('[class*="lg:grid-cols-2"]')).toBeInTheDocument();
  });

  it("keeps identity fields a readable width without constraining the editor", () => {
    renderForm("create");

    for (const id of [
      "project-name",
      "project-type",
      "project-slug",
      "project-summary",
      "project-tags",
      "project-category",
    ]) {
      const field = document.querySelector(`#${id}`);
      expect(field, `field ${id} should exist`).toBeTruthy();
      expect(field?.className, `field ${id} should be capped`).toContain(
        "max-w-2xl"
      );
    }

    // The Markdown editor spans the form: its column is the writing surface,
    // so capping it would undo the side-by-side layout on narrow screens.
    expect(
      document.querySelector("#project-description")?.className
    ).not.toContain("max-w-2xl");
  });
});
