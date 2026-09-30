import { cn } from "cn";
import type { TextareaHTMLAttributes } from "react";

import { RequiredLabel } from "@/components/required-label";

type FormTextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  id: string;
  label: string;
  error?: string;
  helperText?: string;
};

const FormTextarea = ({
  id,
  label,
  error,
  helperText,
  className,
  name,
  ...textareaProps
}: FormTextareaProps) => {
  const errorId = `${id}-error`;
  const helperId = `${id}-helper`;
  const describedBy = [error ? errorId : null, helperText ? helperId : null]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="grid gap-2">
      <RequiredLabel htmlFor={id} isRequired={textareaProps.required}>
        {label}
      </RequiredLabel>

      <textarea
        id={id}
        name={name ?? id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className={cn(
          "border-input bg-background text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 min-h-11 w-full rounded-lg border px-3 py-2 text-sm transition-colors outline-none focus-visible:ring-3",
          error &&
            "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20 dark:border-destructive/50",
          className
        )}
        {...textareaProps}
      />

      {helperText && !error ? (
        <p id={helperId} className="text-muted-foreground text-sm">
          {helperText}
        </p>
      ) : null}

      {error ? (
        <p id={errorId} role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
};

export { FormTextarea };
