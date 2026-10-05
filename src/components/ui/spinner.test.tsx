import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Spinner } from "@/components/ui/spinner";

describe(Spinner, () => {
  it("renders a status region announcing the loading state", () => {
    render(<Spinner />);

    const spinner = screen.getByRole("status");
    expect(spinner.getAttribute("aria-busy")).toBe("true");
  });

  it("uses the provided label as the accessible name", () => {
    render(<Spinner label="Saving changes" />);

    expect(
      screen.getByRole("status", { name: "Saving changes" })
    ).toBeInTheDocument();
  });

  it("defaults to a Loading label", () => {
    render(<Spinner />);

    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
  });
});
