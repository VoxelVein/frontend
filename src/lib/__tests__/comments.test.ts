import { describe, expect, it } from "vitest";

import { buildCommentTree, canRespondToReview } from "@/lib/comments";

interface Row {
  id: string;
  parentId: string | null;
}

const row = (id: string, parentId: string | null = null): Row => ({
  id,
  parentId,
});

describe("comment nesting", () => {
  it("nests replies under their parent regardless of row order", () => {
    const tree = buildCommentTree([
      row("reply", "root"),
      row("nested", "reply"),
      row("root"),
      row("other"),
    ]);

    expect(tree.map((node) => node.comment.id)).toStrictEqual([
      "root",
      "other",
    ]);
    expect(tree[0]?.replies[0]?.comment.id).toBe("reply");
    expect(tree[0]?.replies[0]?.depth).toBe(1);
    expect(tree[0]?.replies[0]?.replies[0]?.depth).toBe(2);
  });

  it("keeps a comment whose parent is missing as a root", () => {
    const tree = buildCommentTree([row("orphan", "deleted")]);

    expect(tree).toHaveLength(1);
    expect(tree[0]?.comment.id).toBe("orphan");
    expect(tree[0]?.depth).toBe(0);
  });

  it("returns nothing for an empty thread", () => {
    expect(buildCommentTree([])).toStrictEqual([]);
  });
});

describe("review responses", () => {
  it("permits only the project creator", () => {
    expect(canRespondToReview("owner", "owner")).toBeTruthy();
    expect(canRespondToReview("owner", "player")).toBeFalsy();
    expect(canRespondToReview(null, "owner")).toBeFalsy();
    expect(canRespondToReview("owner", undefined)).toBeFalsy();
  });
});
