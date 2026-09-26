import { IconAlertCircle, IconCheck, IconLoader2 } from "@tabler/icons-react";
import { cn } from "cn";
import type { InputHTMLAttributes } from "react";

import type { UsernameAvailability } from "@/hooks/use-username-availability";

type UsernameFieldProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type"
> & {
  id: string;
  label: string;
  availability: UsernameAvailability;
  /** Format problem from the form's validation. */
  error?: string;
  helperText?: string;
};

const AvailabilityStatus = ({
  availability,
}: {
  availability: UsernameAvailability;
}) => {
  switch (availability.status) {
    case "checking": {
      return (
        <>
          <IconLoader2
            aria-hidden="true"
            className="size-4 shrink-0 motion-safe:animate-spin"
          />
          Checking availability…
        </>
      );
    }
    case "available": {
      return (
        <>
          <IconCheck aria-hidden="true" className="size-4 shrink-0" />
          This username is available.
        </>
      );
    }
    case "unavailable":
    case "error": {
      return (
        <>
          <IconAlertCircle aria-hidden="true" className="size-4 shrink-0" />
          {availability.message}
        </>
      );
    }
    default: {
      return null;
    }
  }
};

/**
 * A username input that reports availability as the user types. The status
 * line is a polite live region that is always mounted, so screen readers
 * announce each change without the text being read twice.
 */
const UsernameField = ({
  id,
  label,
  availability,
  error,
  helperText,
  className,
  name,
  ...inputProps
}: UsernameFieldProps) => {
  const errorId = `${id}-error`;
  const helperId = `${id}-helper`;
  const statusId = `${id}-status`;
  const isTaken = availability.status === "unavailable";
  const isInvalid = Boolean(error) || isTaken;
  const describedBy = [
    error ? errorId : null,
    helperText ? helperId : null,
    statusId,
  ]
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
        type="text"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        aria-invalid={isInvalid ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          "border-input bg-background text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 min-h-11 w-full rounded-lg border px-3 text-sm transition-colors outline-none focus-visible:ring-3",
          isInvalid &&
            "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20 dark:border-destructive/50",
          inputProps.disabled &&
            "bg-muted/40 text-muted-foreground cursor-not-allowed",
          className
        )}
        {...inputProps}
      />

      {helperText ? (
        <p id={helperId} className="text-muted-foreground text-sm">
          {helperText}
        </p>
      ) : null}

      <p
        id={statusId}
        aria-live="polite"
        className={cn(
          "flex items-center gap-1.5 text-sm empty:hidden",
          availability.status === "available"
            ? "text-foreground"
            : "text-muted-foreground",
          isTaken && "text-destructive"
        )}
      >
        <AvailabilityStatus availability={availability} />
      </p>

      {error ? (
        <p id={errorId} role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
};

export { UsernameField };
