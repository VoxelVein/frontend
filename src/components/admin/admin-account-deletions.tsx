import { IconUserX } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { Button } from "@/components/ui/button";
import {
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  Card,
} from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import type { PendingDeletion } from "@/lib/account-lifecycle";
import {
  listPendingDeletions,
  restoreAccount,
} from "@/lib/admin-accounts.functions";
import { errorMessage } from "@/lib/form-errors";
import { formatDate } from "@/lib/format";

const DeletionsTable = ({
  deletions,
  isMutating,
  onRestore,
}: {
  deletions: PendingDeletion[];
  isMutating: boolean;
  onRestore: (deletion: PendingDeletion) => void;
}) => (
  <div className="border-border mt-4 overflow-x-auto rounded-xl border">
    <table className="w-full text-left text-sm">
      <caption className="sr-only">
        Accounts scheduled for deletion, oldest request first
      </caption>
      <thead className="bg-muted/50 text-muted-foreground text-xs tracking-wide uppercase">
        <tr>
          <th scope="col" className="px-4 py-3 font-medium">
            User
          </th>
          <th scope="col" className="px-4 py-3 font-medium">
            Requested
          </th>
          <th scope="col" className="px-4 py-3 font-medium">
            Deleted on
          </th>
          <th scope="col" className="px-4 py-3 font-medium">
            Projects
          </th>
          <th scope="col" className="px-4 py-3 font-medium">
            <span className="sr-only">Actions</span>
          </th>
        </tr>
      </thead>
      <tbody className="divide-border divide-y">
        {deletions.map((deletion) => (
          <tr key={deletion.id} className="align-top">
            <th scope="row" className="px-4 py-3 font-medium">
              <span className="text-foreground block">{deletion.name}</span>
              <span className="text-muted-foreground block text-xs font-normal break-all">
                {deletion.email}
              </span>
              {deletion.username ? (
                <span className="text-muted-foreground block text-xs font-normal">
                  @{deletion.username}
                </span>
              ) : null}
            </th>
            <td className="text-muted-foreground px-4 py-3 whitespace-nowrap">
              <time dateTime={deletion.deletionRequestedAt}>
                {formatDate(deletion.deletionRequestedAt)}
              </time>
            </td>
            <td className="text-muted-foreground px-4 py-3 whitespace-nowrap">
              <time dateTime={deletion.purgeAt}>
                {formatDate(deletion.purgeAt)}
              </time>
            </td>
            <td className="text-muted-foreground px-4 py-3">
              <span className="block">
                {deletion.projectsToDelete} to delete
              </span>
              <span className="block">{deletion.keptProjects} kept</span>
            </td>
            <td className="px-4 py-3 text-right">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-11"
                disabled={isMutating}
                onClick={() => onRestore(deletion)}
              >
                Restore account
                <span className="sr-only">: {deletion.name}</span>
              </Button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

interface ListState {
  error: string | null;
  isLoading: boolean;
  rows: PendingDeletion[];
}

const LOADING_STATE: ListState = {
  error: null,
  isLoading: true,
  rows: [],
};

const fetchDeletions = async (): Promise<ListState> => {
  try {
    const rows = await listPendingDeletions();
    return { error: null, isLoading: false, rows };
  } catch (error) {
    return {
      error: errorMessage(error, "Could not load pending deletions."),
      isLoading: false,
      rows: [],
    };
  }
};

export const AdminAccountDeletions = () => {
  const [pendingRestore, setPendingRestore] = useState<PendingDeletion | null>(
    null
  );
  const [isMutating, setIsMutating] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  const [list, setList] = useState<ListState>(LOADING_STATE);
  const { error: loadError, isLoading, rows: deletions } = list;

  useEffect(() => {
    let isCurrent = true;
    const loadOnMount = async () => {
      const next = await fetchDeletions();
      if (isCurrent) {
        setList(next);
      }
    };
    void loadOnMount();
    return () => {
      isCurrent = false;
    };
  }, []);

  const load = async () => {
    setList((current) => ({ ...current, error: null, isLoading: true }));
    const next = await fetchDeletions();
    setList(next);
  };

  const handleRestore = async () => {
    if (!pendingRestore) {
      return;
    }
    const { id, name } = pendingRestore;
    setIsMutating(true);
    setRestoreError(null);
    try {
      await restoreAccount({ data: { userId: id } });
      setList((current) => ({
        ...current,
        rows: current.rows.filter((item) => item.id !== id),
      }));
      setPendingRestore(null);
      toast.success(`${name}'s account was restored.`);
    } catch (error) {
      setRestoreError(errorMessage(error, "Could not restore the account."));
    }
    setIsMutating(false);
  };

  let content: ReactNode;

  if (isLoading) {
    content = (
      <div aria-busy="true" className="mt-4 grid gap-3">
        <Skeleton className="h-14" />
        <Skeleton className="h-14" />
      </div>
    );
  } else if (loadError) {
    content = <ErrorState message={loadError} onRetry={() => load()} />;
  } else if (deletions.length === 0) {
    content = (
      <EmptyState
        variant="inline"
        title="No accounts scheduled for deletion"
        description="Accounts that users delete appear here until they are permanently removed."
        icon={<IconUserX size={20} aria-hidden="true" />}
      />
    );
  } else {
    content = (
      <DeletionsTable
        deletions={deletions}
        isMutating={isMutating}
        onRestore={(deletion) => {
          setRestoreError(null);
          setPendingRestore(deletion);
        }}
      />
    );
  }

  return (
    <section aria-labelledby="admin-deletions-heading">
      <Card>
        <CardHeader>
          <h2
            id="admin-deletions-heading"
            className="text-foreground text-lg font-semibold"
          >
            Account deletions
          </h2>
          <CardDescription>
            Deleted accounts are permanently removed 14 days after the request
            unless you restore them.
          </CardDescription>
          <CardAction>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-11"
              disabled={isLoading}
              onClick={() => load()}
            >
              Refresh
            </Button>
          </CardAction>
        </CardHeader>

        <CardContent>
          {content}

          <ConfirmDialog
            open={pendingRestore !== null}
            onOpenChange={(open) => {
              if (!open) {
                setPendingRestore(null);
              }
            }}
            title="Restore account"
            description={
              pendingRestore
                ? `Restore ${pendingRestore.name}'s account? This cancels the scheduled deletion, lets them sign in again, and makes their hidden projects visible again.`
                : ""
            }
            confirmLabel="Restore account"
            variant="default"
            pending={isMutating}
            error={restoreError}
            onConfirm={handleRestore}
          />
        </CardContent>
      </Card>
    </section>
  );
};
