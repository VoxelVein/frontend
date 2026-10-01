import { useForm, useStore } from "@tanstack/react-form";
import { useRef } from "react";

import { FormField } from "@/components/form-field";
import { FormTextarea } from "@/components/form-textarea";
import { MarkdownPreview } from "@/components/markdown-preview";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import {
  postContentSchema,
  postSlugSchema,
  postTitleSchema,
  slugify,
} from "@/lib/posts";
import type { Post, PostInput } from "@/lib/posts";
import { createPost, updatePost } from "@/lib/posts.functions";

interface PostFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  post: Post | null;
  onSaved: (post: Post) => void;
  onError: (error: string) => void;
}

const PostFormDialog = ({
  open,
  onOpenChange,
  post,
  onSaved,
  onError,
}: PostFormDialogProps) => {
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
        const saved = post
          ? await updatePost({ data: { ...input, id: post.id } })
          : await createPost({ data: input });
        onSaved(saved);
        onOpenChange(false);
      } catch (error) {
        onError(
          error instanceof Error ? error.message : "Could not save the post."
        );
      }
    },
  });

  const isSubmitting = useStore(form.store, (state) => state.isSubmitting);
  const submitLabel = post ? "Save changes" : "Create post";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Five fields plus a live preview overflow a short viewport, so the
          panel caps its height and lets the body scroll. The form is the
          scroll container and the footer sits inside it, which keeps the
          submit button reachable from inside the form element. */}
      <DialogContent className="max-h-[calc(100dvh-2rem)] grid-rows-[auto_minmax(0,1fr)] overflow-hidden p-0 sm:max-w-xl">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle>{post ? "Edit post" : "New post"}</DialogTitle>
          <DialogDescription>
            {post
              ? "Update the post details below."
              : "Create a new blog post."}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void form.handleSubmit();
          }}
          className="grid min-h-0 gap-4 overflow-y-auto p-4"
        >
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
              />
            )}
          </form.Field>

          <form.Field name="excerpt">
            {({ state, handleChange, handleBlur }) => (
              <FormTextarea
                id="post-excerpt"
                label="Excerpt"
                rows={2}
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
              <div className="grid gap-2">
                <FormTextarea
                  id="post-content"
                  label="Content (Markdown)"
                  rows={8}
                  value={state.value}
                  onChange={(event) => handleChange(event.target.value)}
                  onBlur={handleBlur}
                  error={state.meta.errors[0]?.message}
                  helperText="Rendered live in the preview beside this field."
                  className="font-mono text-xs"
                />

                <div>
                  <p
                    className="text-foreground text-sm font-medium"
                    id="post-content-preview-label"
                  >
                    Preview
                  </p>
                  <MarkdownPreview
                    labelledBy="post-content-preview-label"
                    value={state.value}
                  />
                </div>
              </div>
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

          {/* The footer is sticky rather than at the end of the scroll
              container, so Save stays reachable without scrolling to the
              bottom. `bg-popover` rather than the footer default's translucent
              `bg-muted/50`, since content passes behind it. */}
          <DialogFooter className="bg-popover sticky bottom-0 z-10 -mx-4 mt-0 -mb-4 rounded-b-none">
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={isSubmitting}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" className="min-h-11" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Spinner label="Saving post" />
                  Saving…
                </>
              ) : (
                submitLabel
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export { PostFormDialog };
