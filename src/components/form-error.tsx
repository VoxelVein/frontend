import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface FormErrorProps {
  children: ReactNode;
  className?: string;
}

/**
 * A form-level error above a form's fields.
 *
 * The three entry points (sign in, sign up, and the username picker) each
 * render the same block, and each had it copy-pasted. It is a live region so
 * an error inserted after a failed submit is announced rather than appearing
 * silently; `Alert` in `ui/` is the same idea but a different visual weight,
 * so this stays its own component rather than reusing that one.
 */
const FormError = ({ children, className }: FormErrorProps) => (
  <div
    role="alert"
    className={cn(
      "border-destructive/30 bg-destructive/10 text-destructive mt-6 rounded-lg border px-3 py-2.5 text-sm",
      className
    )}
  >
    {children}
  </div>
);

export { FormError };
