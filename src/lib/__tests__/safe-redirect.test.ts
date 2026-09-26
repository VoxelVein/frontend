import { describe, expect, it } from "vitest";

import { getSafeRedirect } from "@/lib/safe-redirect";

describe(getSafeRedirect, () => {
  it("keeps relative paths on this site", () => {
    expect(getSafeRedirect("/dashboard/projects?tab=1", "/dashboard")).toBe(
      "/dashboard/projects?tab=1"
    );
  });

  it("falls back for missing or external targets", () => {
    expect(getSafeRedirect(undefined, "/dashboard")).toBe("/dashboard");
    expect(getSafeRedirect("https://evil.example", "/dashboard")).toBe(
      "/dashboard"
    );
    expect(getSafeRedirect("//evil.example", "/dashboard")).toBe("/dashboard");
    expect(getSafeRedirect("/\\evil.example", "/dashboard")).toBe("/dashboard");
    expect(getSafeRedirect("dashboard", "/dashboard")).toBe("/dashboard");
  });
});
