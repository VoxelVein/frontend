import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ProjectImage } from "@/components/projects/project-image";
import { projectFallbackIconUrl } from "@/lib/project-fallback-icon";
import type { ProjectImageView } from "@/lib/project-images";

const icon: ProjectImageView = {
  height: 512,
  id: "image-1",
  url: "/api/image/image-1",
  width: 512,
};

describe(projectFallbackIconUrl, () => {
  it("builds a DiceBear identicon URL seeded with the project id", () => {
    expect(projectFallbackIconUrl("project-1")).toBe(
      "https://api.dicebear.com/9.x/identicon/svg?seed=project-1"
    );
  });

  it("escapes seeds so a slug cannot change the query", () => {
    expect(projectFallbackIconUrl("my project/&")).toBe(
      "https://api.dicebear.com/9.x/identicon/svg?seed=my%20project%2F%26"
    );
  });
});

describe(ProjectImage, () => {
  it("falls back to the seeded identicon instead of a letter tile", () => {
    const { container } = render(
      <ProjectImage
        alt="Example logo"
        className="size-11 rounded-xl border"
        fallbackSeed="project-1"
        image={null}
      />
    );

    const image = screen.getByAltText("Example logo");
    expect(image).toHaveAttribute(
      "src",
      "https://api.dicebear.com/9.x/identicon/svg?seed=project-1"
    );
    expect(image).toHaveAttribute("referrerpolicy", "no-referrer");
    expect(container.querySelector(".size-11")).toBeInTheDocument();
    expect(container).not.toHaveTextContent("E");
  });

  it("shows the uploaded icon rather than a generated one", () => {
    render(
      <ProjectImage alt="Example logo" fallbackSeed="project-1" image={icon} />
    );

    expect(screen.getByAltText("Example logo")).toHaveAttribute(
      "src",
      "/api/image/image-1"
    );
  });
});
