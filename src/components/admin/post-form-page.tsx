import { IconArrowLeft } from "@tabler/icons-react";
import { useForm, useStore } from "@tanstack/react-form";
import { Link } from "@tanstack/react-router";
import { useRef } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/form-field";
import { FormTextarea } from "@/components/form-textarea";
import { MarkdownPreview } from "@/components/markdown-preview";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { errorMessage } from "@/lib/form-errors";
import {
  postContentSchema,
  postSlugSchema,
  postTitleSchema,
  slugify,
} from "@/lib/posts";
import type { Post, PostInput } from "@/lib/posts";
import { createPost, updatePost } from "@/lib/posts.functions";

interface PostFormPageProps {
  /** The post being edited, or null when composing a new one. */
  post: Post | null;
  /** Shown while the editor loads the post it was asked to edit. */
  isLoading?: boolean;
}

/**
 * The post editor, as a page rather than a dialog.
 *
 * It was a modal over the Posts tab, which squeezed a title, slug, excerpt,
 * a Markdown body and a live preview into a panel that had to scroll its own
 * footer. On a page the body is the page: the preview can sit beside the
 * editor on a wide screen instead of under it, and the form no longer has to
 * manage its own scroll container.
 */
const PostFormPage = ({ isLoading = false, post }: PostFormPageProps) => {
  const slugTouchedRef = useRef(false);

  const form = useForm({
    defaultValues: {
      content: post?.content ?? "",
      excerpt: post?.excerpt ?? "",
      published: post?.published ?? false,
      slug: post?.slug ?? "",
      title: post?.title ?? "",
    },
    onSubmit: async ({ value }) => {
      const input: PostInput = {
        content: value.content,
        excerpt: value.excerpt || undefined,
        published: value.published,
        slug: value.slug,
        title: value.title,
      };

      try {
        await (post
          ? updatePost({ data: { ...input, id: post.id } })
          : createPost({ data: input }));
      } catch (saveError) {
        // The form keeps its values so the draft is not lost, and the reason is
        // a toast: this page has no inline error block to put it in.
        toast.error(errorMessage(saveError, "Could not save the post."));
        return;
      }

      toast.success(post ? "Post updated." : "Post created.");

      // A full navigation rather than a router link: the list is refetched on
      // arrival, so the post just written shows up instead of a stale copy.
      window.location.assign("/admin?tab=posts");
    },
  });

  const isSubmitting = useStore(form.store, (state) => state.isSubmitting);
  const submitLabel = post ? "Save changes" : "Create post";

  if (isLoading) {
    return (
      <div
        aria-busy="true"
        className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-14 lg:px-8"
      >
        <Skeleton className="h-11 w-36" />
        <Skeleton className="mt-6 h-9 w-72 max-w-full" />
        <Skeleton className="mt-3 h-5 w-96 max-w-full" />
        <Skeleton className="mt-8 h-72 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-14 lg:px-8">
      <Link
        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring focus-visible:ring-ring/50 inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium focus-visible:ring-3 focus-visible:outline-none"
        to="/admin"
        search={{ tab: "posts" }}
      >
        <IconArrowLeft size={16} aria-hidden="true" />
        Back to posts
      </Link>

      <h1 className="text-foreground mt-4 text-2xl font-bold tracking-tight sm:text-3xl">
        {post ? "Edit post" : "New post"}
      </h1>
      <p className="text-muted-foreground mt-2 text-sm">
        {post ? "Update the post details below." : "Create a new blog post."}
      </p>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
        noValidate
        className="mt-8 grid gap-8 lg:grid-cols-2 lg:items-start"
      >
        <div className="grid gap-4">
          <form.Field name="title" validators={{ onChange: postTitleSchema }}>
            {({ state, handleChange, handleBlur }) => (
              <FormField
                id="post-title"
                label="Title"
                value={state.value}
                onChange={(event) => {
                  handleChange(event.target.value);
                  if (!slugTouchedRef.current) {
                    form.setFieldValue("slug", slugify(event.target.value));
                  }
                }}
                onBlur={handleBlur}
                error={state.meta.errors[0]?.message}
                required
              />
            )}
          </form.Field>

          <form.Field name="slug" validators={{ onChange: postSlugSchema }}>
            {({ state, handleChange, handleBlur }) => (
              <FormField
                id="post-slug"
                label="Slug"
                value={state.value}
                onChange={(event) => {
                  slugTouchedRef.current = true;
                  handleChange(event.target.value);
                }}
                onBlur={handleBlur}
                error={state.meta.errors[0]?.message}
                helperText="Auto-generated from the title. You can edit it."
                required
              />
            )}
          </form.Field>

          <form.Field name="excerpt">
            {({ state, handleChange, handleBlur }) => (
              <FormTextarea
                id="post-excerpt"
                label="Excerpt"
                rows={3}
                value={state.value}
                onChange={(event) => handleChange(event.target.value)}
                onBlur={handleBlur}
                helperText="Short summary shown on the blog listing."
              />
            )}
          </form.Field>

          <form.Field
            name="content"
            validators={{ onChange: postContentSchema }}
          >
            {({ state, handleChange, handleBlur }) => (
              <FormTextarea
                id="post-content"
                label="Content (Markdown)"
                rows={20}
                value={state.value}
                onChange={(event) => handleChange(event.target.value)}
                onBlur={handleBlur}
                error={state.meta.errors[0]?.message}
                helperText="Rendered live in the preview beside this field."
                className="font-mono text-xs"
              />
            )}
          </form.Field>

          <form.Field name="published">
            {({ state, handleChange }) => (
              <div className="border-border bg-muted/40 flex items-start gap-3 rounded-lg border p-3">
                <Checkbox
                  id="post-published"
                  checked={state.value}
                  onCheckedChange={handleChange}
                  className="mt-0.5"
                />
                <div className="grid gap-0.5">
                  <label
                    htmlFor="post-published"
                    className="text-foreground text-sm font-medium"
                  >
                    Published
                  </label>
                  <p className="text-muted-foreground text-sm">
                    Make this post visible to visitors.
                  </p>
                </div>
              </div>
            )}
          </form.Field>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" className="min-h-11" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Spinner className="mr-1" label="Saving post" />
                  Saving…
                </>
              ) : (
                submitLabel
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="min-h-11"
              disabled={isSubmitting}
              render={<Link to="/admin" search={{ tab: "posts" }} />}
            >
              Cancel
            </Button>
          </div>
        </div>

        {/* Beside the editor rather than under it, which is the whole reason
            this is a page: a wide screen has room for both at once. */}
        <div className="grid gap-2 lg:sticky lg:top-8">
          <p
            className="text-foreground text-sm font-medium"
            id="post-content-preview-label"
          >
            Preview
          </p>
          <form.Field name="content">
            {({ state }) => (
              <MarkdownPreview
                labelledBy="post-content-preview-label"
                maxHeightClassName="max-h-[36rem] min-h-32"
                value={state.value}
              />
            )}
          </form.Field>
        </div>
      </form>
    </div>
  );
};

export { PostFormPage };
