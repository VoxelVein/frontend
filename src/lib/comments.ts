/**
 * Rules and view shapes shared by blog comments and review responses.
 */

/** Room for a real thought, still short enough to read in a comment column. */
export const COMMENT_MAX_LENGTH = 1000;

/** A creator's response to a review should stay a reply, not a second review. */
export const REVIEW_RESPONSE_MAX_LENGTH = 500;

export interface CommentNodeInput {
  id: string;
  parentId: string | null;
}

export interface CommentTreeNode<T extends CommentNodeInput> {
  comment: T;
  /** Zero for a top-level comment; used to indent nested replies. */
  depth: number;
  replies: CommentTreeNode<T>[];
}

/**
 * Turns a flat, creation-ordered list into the tree the comment list renders.
 *
 * A child whose parent is missing from the result (a deleted parent that did
 * not cascade, or a reply to a comment on another post) is treated as a root
 * rather than silently vanishing from the page.
 */
export const buildCommentTree = <T extends CommentNodeInput>(
  comments: readonly T[]
): CommentTreeNode<T>[] => {
  const nodes = new Map<string, CommentTreeNode<T>>();

  for (const comment of comments) {
    nodes.set(comment.id, { comment, depth: 0, replies: [] });
  }

  const roots: CommentTreeNode<T>[] = [];

  for (const comment of comments) {
    const node = nodes.get(comment.id);

    if (!node) {
      continue;
    }

    const parent =
      comment.parentId === null ? undefined : nodes.get(comment.parentId);

    if (parent) {
      parent.replies.push(node);
    } else {
      roots.push(node);
    }
  }

  // Depth is assigned from the roots so it never depends on row order.
  const assignDepth = (node: CommentTreeNode<T>, depth: number): void => {
    node.depth = depth;

    for (const reply of node.replies) {
      assignDepth(reply, depth + 1);
    }
  };

  for (const root of roots) {
    assignDepth(root, 0);
  }

  return roots;
};

/** Only the project's creator may answer one of its reviews. */
export const canRespondToReview = (
  ownerId: string | null,
  userId: string | undefined
): boolean => ownerId !== null && userId !== undefined && ownerId === userId;
