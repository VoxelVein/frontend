import { describe, expect, it } from "vitest";

import { replyForTurn } from "@/lib/chatbot-response";

describe(replyForTurn, () => {
  it("starts with the 'I don't know' answer", () => {
    expect(replyForTurn(0).message).toContain("I don't know");
  });

  it("gives the content-policy answer on the second turn", () => {
    expect(replyForTurn(1).message).toContain("violates my content policies");
  });

  it("gives the off-topic answer on the third turn", () => {
    expect(replyForTurn(2).message).toContain(
      "not related to VoxelVein or associated services"
    );
  });

  it("cycles back after the third turn", () => {
    expect(replyForTurn(3)).toStrictEqual(replyForTurn(0));
    expect(replyForTurn(300)).toStrictEqual(replyForTurn(0));
  });

  it("never throws for a negative turn", () => {
    expect(["unknown", "policy", "off-topic"]).toContain(replyForTurn(-1).kind);
  });

  it("always returns one of exactly three long-form answers", () => {
    const kinds = new Set(
      Array.from({ length: 9 }, (_, turn) => replyForTurn(turn).kind)
    );

    expect([...kinds].toSorted()).toStrictEqual([
      "off-topic",
      "policy",
      "unknown",
    ]);

    for (const turn of [0, 1, 2, 3]) {
      expect(replyForTurn(turn).message.length).toBeGreaterThan(100);
    }
  });
});
