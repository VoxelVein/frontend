import { useEffect } from "react";
import { toast } from "sonner";

/**
 * Announces a server or query failure as a Sonner toast instead of leaving an
 * inline error on the page. Field validation and "not configured yet" notices
 * stay where they are, because they belong to the control or the admin panel.
 *
 * A stable `id` keeps a refetch from stacking the same message twice.
 */
export const useToastError = (
  message: string | null | undefined,
  id: string
): void => {
  useEffect(() => {
    if (message) {
      toast.error(message, { id });
    }
  }, [id, message]);
};
