import { cn } from "cn";
import type { TextareaHTMLAttributes } from "react";

import { FormTextarea } from "@/components/form-textarea";
import { MarkdownPreview } from "@/components/markdown-preview";

interface MarkdownEditorProps extends Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  "className"
> {
  className?: string;
  error?: string;
  helperText?: string;
  id: string;
  label: string;
  /** Shown in the preview when the field is blank. */
  previewEmptyMessage?: string;
  previewLabel?: string;
  previewMaxHeightClassName?: string;
  /** Lets a caller preview a debounced value while the field stays immediate. */
  previewValue?: string;
  /** Markdown editors always take text; narrow the textarea union here. */
  value: string;
}

/**
 * A Markdown textarea with its preview beside it.
 *
 * The editor and preview share one row from `lg` up, then stack in source order
 * on smaller screens. Keeping them in one component means every Markdown
 * surface  -  project descriptions, release changelogs, and profile bios  -  gets
 * the same synchronised layout instead of three slightly different ones.
 */
export const MarkdownEditor = ({
  className,
  error,
  helperText,
  id,
  label,
  previewEmptyMessage,
  previewLabel = "Preview",
  previewMaxHeightClassName = "max-h-[28rem] min-h-56",
  previewValue,
  value,
  ...textareaProps
}: MarkdownEditorProps) => {
  const previewLabelId = `${id}-preview-label`;

  return (
    <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
      <FormTextarea
        id={id}
        label={label}
        error={error}
        helperText={helperText}
        value={value}
        className={cn("min-h-56 font-mono text-xs", className)}
        {...textareaProps}
      />

      <div className="grid gap-1.5">
        <p className="text-foreground text-sm font-medium" id={previewLabelId}>
          {previewLabel}
        </p>
        <MarkdownPreview
          emptyMessage={previewEmptyMessage}
          labelledBy={previewLabelId}
          maxHeightClassName={previewMaxHeightClassName}
          value={previewValue ?? value}
        />
      </div>
    </div>
  );
};
