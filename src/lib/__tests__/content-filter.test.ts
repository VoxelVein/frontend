import { describe, expect, it } from "vitest";

import { containsBlockedWord } from "@/lib/content-filter";

describe("review and comment text", () => {
  it("blocks plain profanity", () => {
    expect(containsBlockedWord("what the fuck")).toBeTruthy();
    expect(containsBlockedWord("This is shit.")).toBeTruthy();
    expect(containsBlockedWord("NiGGER")).toBeTruthy();
  });

  it("catches common obfuscation", () => {
    expect(containsBlockedWord("f*ck this")).toBeTruthy();
    expect(containsBlockedWord("sh1t")).toBeTruthy();
    expect(containsBlockedWord("f u c k")).toBeFalsy();
  });

  it("leaves ordinary words alone", () => {
    expect(
      containsBlockedWord("A great class with a passionate tutor")
    ).toBeFalsy();
    expect(
      containsBlockedWord("The assassination scene was brilliant")
    ).toBeFalsy();
    expect(containsBlockedWord("")).toBeFalsy();
  });
});
