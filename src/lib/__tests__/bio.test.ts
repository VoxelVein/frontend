import { safeParse } from "valibot";
import { describe, expect, it } from "vitest";

import {
  BIO_MAX_LENGTH,
  bioInputSchema,
  bioSchema,
  normalizeBio,
} from "@/lib/bio";

const atCap = "a".repeat(BIO_MAX_LENGTH);

describe(normalizeBio, () => {
  it("trims what it stores", () => {
    expect(normalizeBio("  I make mods.  ")).toBe("I make mods.");
  });

  it("keeps interior newlines, which Markdown needs", () => {
    expect(normalizeBio("Line one\n\nLine two")).toBe("Line one\n\nLine two");
  });

  it("turns an empty bio into null rather than an empty string", () => {
    expect(normalizeBio("")).toBeNull();
  });

  it("treats a whitespace-only bio as no bio", () => {
    // Otherwise the profile renders an empty block where the bio was.
    expect(normalizeBio("   \n\t ")).toBeNull();
  });
});

describe(bioSchema, () => {
  it("accepts a bio exactly at the cap", () => {
    expect(safeParse(bioSchema, atCap).success).toBe(true);
  });

  it("rejects one character over the cap", () => {
    const result = safeParse(bioSchema, `${atCap}a`);

    expect(result.success).toBe(false);
    expect(result.issues?.[0]?.message).toBe(
      `Bio must be ${BIO_MAX_LENGTH} characters or fewer.`
    );
  });

  it("accepts an empty bio, because clearing the field is how it is removed", () => {
    expect(safeParse(bioSchema, "").success).toBe(true);
  });

  it("accepts a whitespace-only bio rather than trapping the user", () => {
    // Rejecting this would make "clear this field" an error with no way to
    // resolve it short of deleting characters one at a time.
    expect(safeParse(bioSchema, "   ").success).toBe(true);
  });

  it("rejects a non-string", () => {
    expect(safeParse(bioSchema, 42).success).toBe(false);
  });
});

describe(bioInputSchema, () => {
  it("accepts a normal bio", () => {
    expect(safeParse(bioInputSchema, "I make mods.").success).toBe(true);
  });

  it("accepts null, which is how the form clears a bio", () => {
    expect(safeParse(bioInputSchema, null).success).toBe(true);
  });

  it("accepts an absent value", () => {
    expect(safeParse(bioInputSchema).success).toBe(true);
  });

  it("rejects a bio past the cap at the server boundary", () => {
    // This is the check a direct call to the update endpoint cannot get past.
    expect(
      safeParse(bioInputSchema, "a".repeat(BIO_MAX_LENGTH + 1)).success
    ).toBe(false);
  });

  it("rejects a non-string that is not nullish", () => {
    expect(safeParse(bioInputSchema, 42).success).toBe(false);
  });
});
