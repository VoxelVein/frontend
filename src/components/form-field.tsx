import { cn } from "cn";
import type { InputHTMLAttributes } from "react";

type FormFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
  error?: string;
  helperText?: string;
};

const FormField = ({
  id,
  label,
  error,
  helperText,
  className,
  name,
  ...inputProps
}: FormFieldProps) => {
  const errorId = `${id}-error`;
  const helperId = `${id}-helper`;
  const describedBy = [error ? errorId : null, helperText ? helperId : null]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="text-foreground text-sm font-medium">
        {label}
      </label>

      <input
        id={id}
        name={name ?? id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className={cn(
          "border-input bg-background text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 min-h-11 w-full rounded-lg border px-3 text-sm transition-colors outline-none focus-visible:ring-3",
          error &&
            "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20 dark:border-destructive/50",
          // A read-only field must not look editable: no focus ring, muted
          // surface, and the browser's own text cursor suppressed.
          inputProps.readOnly &&
            "bg-muted/40 text-muted-foreground focus-visible:border-input cursor-default focus-visible:ring-0",
          className
        )}
        {...inputProps}
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

export { FormField };
