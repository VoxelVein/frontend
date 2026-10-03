import { describe, expect, it } from "vitest";

import {
  AVATAR_URL_MAX_LENGTH,
  isExternalAvatarSrc,
  isSafeAvatarSrc,
  parseAvatarUrl,
} from "@/lib/avatar-url";

// oxlint-disable no-script-url -- This file is the validation suite for a field that
// accepts a URL a person typed. Every `javascript:`, `data:`, and `http:` literal here is
// an attack shape being refused, and several exist specifically to pin down a spelling
// that only matters written verbatim. Assembling them indirectly to satisfy the linter
// would obscure the thing under test, so the rule is off for this file only.
// `avatar-url.ts` keeps it on, where such a literal would be a genuine finding.

/**
 * The reason a value was refused, or an empty string when it was accepted.
 *
 * Reading the message out of the result rather than branching on it inside each
 * test keeps every assertion unconditional — a test that only asserts on the
 * failure branch passes silently when the value turns out to be valid.
 */
const errorFor = (value: string): string => {
  const result = parseAvatarUrl(value);

  return result.ok ? "" : result.error;
};

describe(parseAvatarUrl, () => {
  it("accepts an https image URL", () => {
    expect(parseAvatarUrl("https://cdn.example.com/me.png")).toStrictEqual({
      ok: true,
      url: "https://cdn.example.com/me.png",
    });
  });

  it("keeps a signed CDN query string intact", () => {
    // Dropping the query would break exactly the URLs people actually paste.
    const url = "https://cdn.example.com/me.png?w=256&sig=abc123";

    expect(parseAvatarUrl(url)).toStrictEqual({ ok: true, url });
  });

  it("trims surrounding whitespace from a paste", () => {
    expect(parseAvatarUrl("  https://cdn.example.com/me.png \n")).toStrictEqual(
      { ok: true, url: "https://cdn.example.com/me.png" }
    );
  });

  it("reads an empty field as 'no picture' rather than as an error", () => {
    // Emptying a field is how a person clears a picture, so this must not be
    // refused — otherwise the field could set what it could not unset.
    expect(parseAvatarUrl("")).toStrictEqual({ ok: true, url: null });
    expect(parseAvatarUrl("   ")).toStrictEqual({ ok: true, url: null });
  });

  it("refuses plain http", () => {
    // Blocked as mixed content on an HTTPS site anyway, so storing it would only
    // produce a picture that never renders.
    expect(errorFor("http://cdn.example.com/me.png")).toBeTruthy();
  });

  it("refuses every other scheme", () => {
    for (const url of [
      "javascript:alert(1)",
      "JaVaScRiPt:alert(1)",
      "data:image/png;base64,iVBORw0KGgo=",
      "vbscript:msgbox(1)",
      "file:///etc/passwd",
      "blob:https://example.com/x",
    ]) {
      expect(errorFor(url)).toBeTruthy();
    }
  });

  it("refuses a relative path, which is not a picture someone else hosts", () => {
    expect(errorFor("/api/avatar/123")).toBeTruthy();
    expect(errorFor("me.png")).toBeTruthy();
  });

  it("refuses a protocol-relative URL", () => {
    // `//host/x` inherits the page scheme and reaches another origin, so it is an
    // external URL that would skip the https check.
    expect(errorFor("//cdn.example.com/me.png")).toBeTruthy();
  });

  it("refuses credentials embedded in the authority", () => {
    // They leak into logs, referrers, and anywhere the URL is shown as text.
    expect(errorFor("https://user:pass@cdn.example.com/me.png")).toMatch(
      /username and password/iu
    );
  });

  it("refuses a bare origin, which is almost always a truncated paste", () => {
    expect(errorFor("https://cdn.example.com")).toBeTruthy();
    expect(errorFor("https://cdn.example.com/")).toBeTruthy();
  });

  it("refuses a URL beyond the length cap", () => {
    const long = `https://cdn.example.com/${"a".repeat(AVATAR_URL_MAX_LENGTH)}`;

    expect(errorFor(long)).toMatch(/too long/iu);
  });

  it("gives the same reason for every plain refusal", () => {
    // One message for the whole https rule, so a person is told what to do
    // rather than being told which check tripped.
    expect(errorFor("http://cdn.example.com/me.png")).toBe(
      errorFor("javascript:alert(1)")
    );
  });
});

describe(isSafeAvatarSrc, () => {
  it("allows this site's own avatar paths", () => {
    expect(isSafeAvatarSrc("/api/avatar/2f1c-uuid")).toBeTruthy();
  });

  it("allows an https URL", () => {
    expect(isSafeAvatarSrc("https://cdn.example.com/me.png")).toBeTruthy();
  });

  it("refuses anything else, so no third scheme can be rendered", () => {
    for (const value of [
      "javascript:alert(1)",
      "data:image/png;base64,iVBORw0KGgo=",
      "http://cdn.example.com/me.png",
      "//cdn.example.com/me.png",
      "me.png",
      "",
      null,
      undefined,
    ]) {
      expect(isSafeAvatarSrc(value)).toBeFalsy();
    }
  });
});

describe(isExternalAvatarSrc, () => {
  it("separates a hosted-elsewhere picture from an upload", () => {
    expect(isExternalAvatarSrc("https://cdn.example.com/me.png")).toBeTruthy();
    expect(isExternalAvatarSrc("/api/avatar/2f1c-uuid")).toBeFalsy();
    expect(isExternalAvatarSrc(null)).toBeFalsy();
  });
});
