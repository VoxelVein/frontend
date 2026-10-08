import { notFound } from "@tanstack/react-router";

import type { Post } from "@/lib/posts";
import { getPost } from "@/lib/posts.functions";

/**
 * Fetches one post, signalling the router's not-found condition when the slug
 * matches nothing.
 *
 * Lives in its own module rather than the route file so the blog post route and
 * its test share the same seam without the route module exporting non-component
 * values (which would break Fast Refresh).
 */
export const loadPost = async (slug: string): Promise<Post> => {
  const post = await getPost({ data: { slug } });
  if (!post) {
    throw notFound();
  }
  return post;
};
