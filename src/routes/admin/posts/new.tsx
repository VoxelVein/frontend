import { createFileRoute } from "@tanstack/react-router";

import { PostFormPage } from "@/components/admin/post-form-page";

const NewPostPage = () => <PostFormPage post={null} />;

export const Route = createFileRoute("/admin/posts/new")({
  head: () => ({ meta: [{ title: "New post | VoxelVein" }] }),
  component: NewPostPage,
});
