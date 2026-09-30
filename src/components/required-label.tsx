import { cn } from "@/lib/utils";

interface RequiredLabelProps {
  children: React.ReactNode;
  className?: string;
  htmlFor: string;
  /** Drives the marker. Keep this in step with the control's own `required`. */
  isRequired?: boolean;
}

/**
 * A form label with a red asterisk when its control is required.
 *
 * The asterisk sits outside the `<label>`, not inside it. Inside, it would
 * become part of the label's accessible name, so the field would announce as
 * "Email or username star" and any exact-match label lookup would have to
 * account for the glyph. The control already carries the real `required`
 * attribute, so the marker is purely visual and is hidden from assistive
 * technology.
 */
export const RequiredLabel = ({
  children,
  className,
  htmlFor,
  isRequired = false,
}: RequiredLabelProps) => (
  <span className="flex items-center gap-0.5">
    <label
      htmlFor={htmlFor}
      className={cn("text-foreground text-sm font-medium", className)}
    >
      {children}
    </label>
    {isRequired ? (
      <span aria-hidden="true" className="text-destructive">
        *
      </span>
    ) : null}
  </span>
);
