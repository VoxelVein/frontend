import { createFileRoute, useLoaderData } from "@tanstack/react-router";

import { PostFormPage } from "@/components/admin/post-form-page";
import { getPostById } from "@/lib/posts.functions";

interface EditPostLoaderData {
  post: Awaited<ReturnType<typeof getPostById>>;
}

/**
 * `/admin/posts/$postId/edit`.
 *
 * The post is fetched in the loader rather than in an effect on mount, so the
 * editor is populated on first paint instead of flashing empty fields and then
 * filling them in — which is what the modal did, since it could only start
 * fetching after it was already open.
 */
const EditPostPage = () => {
  const { post } = useLoaderData({ from: "/admin/posts/$postId/edit" });

  return <PostFormPage post={post} />;
};

export const Route = createFileRoute("/admin/posts/$postId/edit")({
  loader: async ({ params }): Promise<EditPostLoaderData> => {
    const post = await getPostById({ data: { id: params.postId } });
    return { post };
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData?.post
          ? `Edit ${loaderData.post.title} | VoxelVein`
          : "Post not found | VoxelVein",
      },
    ],
  }),
  component: EditPostPage,
});
