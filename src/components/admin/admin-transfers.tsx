import { IconArrowsExchange } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/form-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { adminTransferProject } from "@/lib/project-transfers.functions";

/**
 * Staff hand-off. Unlike an owner's offer, this changes ownership at once; the
 * form says so before the admin clicks, because there is no second confirmation.
 */
export const AdminTransfers = () => {
  const client = useQueryClient();
  const [projectId, setProjectId] = useState("");
  const [recipient, setRecipient] = useState("");

  const transfer = useMutation({
    mutationFn: () =>
      adminTransferProject({
        data: { projectId, recipient },
      }),
    onSuccess: (result) => {
      toast.success(`${result.projectName} now belongs to ${recipient}.`);
      void client.invalidateQueries({ queryKey: ["project-transfers"] });
      void client.invalidateQueries({ queryKey: ["project"] });
      setProjectId("");
      setRecipient("");
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <section aria-labelledby="admin-transfers-heading" className="max-w-2xl">
      <h2
        className="text-foreground text-xl font-semibold"
        id="admin-transfers-heading"
      >
        Project transfers
      </h2>
      <p className="text-muted-foreground mt-1 text-sm">
        Move a project to another member. This takes effect immediately and
        cancels any owner-offered transfer still waiting for a reply.
      </p>

      <Card className="mt-6" size="sm">
        <CardHeader>
          <CardTitle>Transfer a project</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              transfer.mutate();
            }}
          >
            <FormField
              helperText="Copy the project ID from its manage page URL."
              id="admin-transfer-project-id"
              label="Project ID"
              onChange={(event) => setProjectId(event.target.value)}
              required
              value={projectId}
            />
            <FormField
              helperText="The new owner's username or email address."
              id="admin-transfer-recipient"
              label="New owner"
              onChange={(event) => setRecipient(event.target.value)}
              required
              value={recipient}
            />
            <Alert>
              <IconArrowsExchange aria-hidden size={16} />
              <AlertDescription>
                Both the previous and the new owner receive a notification.
              </AlertDescription>
            </Alert>
            <Button
              disabled={transfer.isPending}
              type="submit"
              variant="outline"
            >
              {transfer.isPending ? "Transferring…" : "Transfer project"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </section>
  );
};
