import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FormField } from "@/components/form-field";
import { FormTextarea } from "@/components/form-textarea";

describe("required field marker", () => {
  it("marks a required input", () => {
    render(<FormField id="name" label="Name" required />);

    const label = screen.getByText("Name");
    const marker = label.parentElement?.querySelector(
      'span[aria-hidden="true"]'
    );

    expect(marker?.textContent).toBe("*");
  });

  it("leaves an optional input unmarked", () => {
    render(<FormField id="tags" label="Tags" />);

    const label = screen.getByText("Tags");
    const marker = label.parentElement?.querySelector(
      'span[aria-hidden="true"]'
    );

    expect(marker).toBeNull();
  });

  it("marks a required textarea", () => {
    render(<FormTextarea id="summary" label="Summary" required />);

    const label = screen.getByText("Summary");
    const marker = label.parentElement?.querySelector(
      'span[aria-hidden="true"]'
    );

    expect(marker?.textContent).toBe("*");
  });

  it("keeps the asterisk out of the accessible name", () => {
    render(<FormField id="name" label="Name" required />);

    // The marker sits outside <label> on purpose: inside it, the field would
    // announce as "Name star". The required state comes from the attribute.
    expect(screen.getByLabelText("Name")).toBeTruthy();
  });
});
