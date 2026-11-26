import { Button } from "@/components/ui/button";
import { useToastError } from "@/hooks/use-toast-error";

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

/** Server failures are announced by Sonner; this only keeps the retry action. */
const ErrorState = ({ message, onRetry }: ErrorStateProps) => {
  useToastError(message, `error-state-${message}`);

  if (!onRetry) {
    return null;
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="min-h-11"
      onClick={onRetry}
    >
      Try again
    </Button>
  );
};

export { ErrorState };
