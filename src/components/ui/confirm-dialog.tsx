import { cn } from "cn";
import type { ReactNode } from "react";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

type ConfirmDialogVariant = "default" | "destructive";

type ConfirmDialogSize = "sm" | "md" | "lg";

const SIZES: Record<ConfirmDialogSize, string> = {
  // `sm` matches the primitive default; the rest are opt-in so a confirmation
  // whose copy embeds a long name is not squeezed into a 24rem column.
  sm: "",
  md: "sm:max-w-md",
  lg: "sm:max-w-lg",
};

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  onConfirm: () => void | Promise<void>;
  pending?: boolean;
  error?: string | null;
  cancelLabel?: string;
  variant?: ConfirmDialogVariant;
  size?: ConfirmDialogSize;
}

const ConfirmDialog = ({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  pending = false,
  error = null,
  cancelLabel = "Cancel",
  variant = "destructive",
  size = "sm",
}: ConfirmDialogProps) => (
  <AlertDialog open={open} onOpenChange={onOpenChange}>
    <AlertDialogContent
      className={cn(
        SIZES[size],
        variant === "destructive" && "border-destructive/40"
      )}
    >
      <AlertDialogHeader>
        <AlertDialogTitle>{title}</AlertDialogTitle>
        <AlertDialogDescription>{description}</AlertDialogDescription>
      </AlertDialogHeader>

      {error && (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      )}

      <AlertDialogFooter>
        <Button
          variant="outline"
          className="min-h-11"
          disabled={pending}
          onClick={() => onOpenChange(false)}
        >
          {cancelLabel}
        </Button>
        <Button
          variant={variant}
          className="min-h-11"
          disabled={pending}
          onClick={() => {
            void onConfirm();
          }}
        >
          {pending && <Spinner label="Pending action" />}
          {pending ? "Processing…" : confirmLabel}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);

export { ConfirmDialog };
