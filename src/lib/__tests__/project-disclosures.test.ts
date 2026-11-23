import { safeParse } from "valibot";
import { describe, expect, it } from "vitest";

import {
  DISCLOSURE_TYPE_HINTS,
  DISCLOSURE_TYPE_LABELS,
  DISCLOSURE_TYPES,
  projectInputSchema,
} from "@/lib/projects";
import type { ProjectDisclosure } from "@/lib/projects";

const projectInput = (disclosures: ProjectDisclosure[]) => ({
  category: "optimization",
  description: "Makes the game faster.",
  name: "Sodium",
  slug: "sodium",
  summary: "A modern rendering engine.",
  tags: ["performance"],
  type: "mod" as const,
  disclosures,
});

describe("project disclosures", () => {
  it("gives every disclosure type a label and a hint", () => {
    for (const type of DISCLOSURE_TYPES) {
      expect(DISCLOSURE_TYPE_LABELS[type], `${type} label`).toBeTruthy();
      expect(DISCLOSURE_TYPE_HINTS[type], `${type} hint`).toBeTruthy();
    }
  });

  it("accepts every declared type", () => {
    const disclosures = DISCLOSURE_TYPES.map((type) => ({
      description: `Details for ${type}.`,
      type,
    }));

    const result = safeParse(projectInputSchema, projectInput(disclosures));

    expect(result.success).toBeTruthy();
    expect(result.success && result.output.disclosures).toHaveLength(
      DISCLOSURE_TYPES.length
    );
  });

  it("trims the description a creator writes", () => {
    const result = safeParse(
      projectInputSchema,
      projectInput([
        {
          description: "  The icon art was generated with AI.  ",
          type: "ai-generated",
        },
      ])
    );

    expect(result.success && result.output.disclosures[0]?.description).toBe(
      "The icon art was generated with AI."
    );
  });

  it("rejects a disclosure without a description", () => {
    const result = safeParse(
      projectInputSchema,
      projectInput([{ description: "   ", type: "statistics" }])
    );

    expect(result.success).toBeFalsy();
  });

  it("rejects the same disclosure type twice", () => {
    const result = safeParse(
      projectInputSchema,
      projectInput([
        { description: "First reason.", type: "discontinued" },
        { description: "Second reason.", type: "discontinued" },
      ])
    );

    expect(result.success).toBeFalsy();
  });
});
