import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Avatar } from "@/components/avatar";

// oxlint-disable no-script-url -- Adversarial fixtures: the point of these tests is that a
// `javascript:` or `data:` value reaches the component and is refused, so the strings must
// be written exactly as they would appear in the column.

describe(Avatar, () => {
  it("renders an image for a picture stored on this site", () => {
    const { container } = render(
      <Avatar image="/api/avatar/2f1c-uuid" name="Hedi Zandi" />
    );

    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      "/api/avatar/2f1c-uuid"
    );
  });

  it("renders an image for an external https picture", () => {
    const { container } = render(
      <Avatar image="https://cdn.example.com/me.png" name="Hedi Zandi" />
    );

    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      "https://cdn.example.com/me.png"
    );
  });

  it("sends no referrer, so an external host learns no profile page from it", () => {
    const { container } = render(
      <Avatar image="https://cdn.example.com/me.png" name="Hedi Zandi" />
    );

    // The picture may be hosted elsewhere; a referrer would tell that host which
    // profile a visitor was reading.
    expect(container.querySelector("img")).toHaveAttribute(
      "referrerpolicy",
      "no-referrer"
    );
  });

  it("falls back to initials rather than rendering a javascript: source", () => {
    const { container } = render(
      <Avatar image="javascript:alert(1)" name="Hedi Zandi" />
    );

    expect(container.querySelector("img")).toBeNull();
    expect(container).toHaveTextContent("H");
  });

  it("refuses any other scheme, including data:", () => {
    for (const value of [
      "data:image/png;base64,iVBORw0KGgo=",
      "http://cdn.example.com/me.png",
      "//cdn.example.com/me.png",
      "me.png",
    ]) {
      const { container } = render(
        <Avatar image={value} name="Ada Lovelace" />
      );

      expect(container.querySelector("img")).toBeNull();
      expect(container).toHaveTextContent("A");
    }
  });

  it("shows the initial when there is no picture at all", () => {
    const { container } = render(<Avatar image={null} name="Ben Sabic" />);

    expect(container.querySelector("img")).toBeNull();
    expect(container).toHaveTextContent("B");
  });

  it("stays silent about the picture when it sits beside the name", () => {
    // Announcing "Hedi Zandi's avatar" immediately before "Hedi Zandi" makes a
    // screen reader say the name twice.
    const { container } = render(
      <Avatar image="https://cdn.example.com/me.png" name="Hedi Zandi" />
    );

    const img = container.querySelector("img");

    expect(img).toHaveAttribute("aria-hidden", "true");
    expect(img).toHaveAttribute("alt", "");
    expect(
      screen.queryByRole("img", { name: "Hedi Zandi's avatar" })
    ).not.toBeInTheDocument();
  });

  it("names the picture when it is the only representation", () => {
    render(
      <Avatar
        decorative={false}
        image="https://cdn.example.com/me.png"
        name="Hedi Zandi"
      />
    );

    expect(
      screen.getByRole("img", { name: "Hedi Zandi's avatar" })
    ).toBeInTheDocument();
  });

  it("falls back to a question mark for a name with no letters", () => {
    // An empty circle reads as a broken image; a letter reads as an avatar with
    // no photo.
    const { container } = render(<Avatar image={null} name="   " />);

    expect(container).toHaveTextContent("?");
  });
});
