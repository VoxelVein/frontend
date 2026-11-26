import { describe, expect, it } from "vitest";

import { parseGithubReleases, RELEASES_URL } from "@/lib/github-releases";

/** A trimmed version of the shape GitHub actually sends. */
interface ApiRelease {
  body: string | null;
  created_at: string;
  draft: boolean;
  html_url: string;
  name: string | null;
  published_at: string | null;
  tag_name: string;
}

const apiRelease = (overrides: Partial<ApiRelease> = {}): ApiRelease => ({
  body: "### Features\n\n* new",
  created_at: "2026-11-20T00:00:00Z",
  draft: false,
  html_url: "https://github.com/VoxelVein/frontend/releases/tag/ALPHA-0.18.0",
  name: "ALPHA-0.18.0",
  published_at: "2026-11-26T00:00:00Z",
  tag_name: "ALPHA-0.18.0",
  ...overrides,
});

describe("GitHub releases client", () => {
  it("requests every release in one page", () => {
    expect(RELEASES_URL).toContain("per_page=100");
    expect(RELEASES_URL).toContain("VoxelVein/frontend/releases");
  });

  it("maps a valid payload into view models", () => {
    expect(parseGithubReleases([apiRelease()])).toStrictEqual([
      {
        body: "### Features\n\n* new",
        htmlUrl:
          "https://github.com/VoxelVein/frontend/releases/tag/ALPHA-0.18.0",
        name: "ALPHA-0.18.0",
        publishedAt: "2026-11-26T00:00:00Z",
        tag: "ALPHA-0.18.0",
      },
    ]);
  });

  it("sorts newest first regardless of API order", () => {
    const releases = parseGithubReleases([
      apiRelease({
        name: "ALPHA-0.17.0",
        published_at: "2026-11-24T00:00:00Z",
        tag_name: "ALPHA-0.17.0",
      }),
      apiRelease(),
    ]);

    expect(releases.map((release) => release.tag)).toStrictEqual([
      "ALPHA-0.18.0",
      "ALPHA-0.17.0",
    ]);
  });

  it("hides drafts so the page never announces unfinished work", () => {
    expect(
      parseGithubReleases([apiRelease(), apiRelease({ draft: true })])
    ).toHaveLength(1);
  });

  it("falls back to the tag and creation time when fields are missing", () => {
    const [release] = parseGithubReleases([
      apiRelease({ name: null, published_at: null }),
    ]);

    expect(release?.name).toBe("ALPHA-0.18.0");
    expect(release?.publishedAt).toBe("2026-11-20T00:00:00Z");
  });

  it("uses an empty body when GitHub sends null", () => {
    expect(parseGithubReleases([apiRelease({ body: null })])[0]?.body).toBe("");
  });

  it("rejects a malformed payload instead of rendering garbage", () => {
    expect(() => parseGithubReleases({ releases: [] })).toThrow(
      "unexpected release format"
    );
    expect(() => parseGithubReleases([{ tag_name: 42 }])).toThrow(
      "unexpected release format"
    );
  });
});
