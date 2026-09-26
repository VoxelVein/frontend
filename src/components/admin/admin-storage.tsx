import { useEffect, useState } from "react";

import { AlertDescription, Alert } from "@/components/ui/alert";
import { CardContent, CardHeader, Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { errorMessage } from "@/lib/form-errors";
import { formatBytes, formatCount } from "@/lib/format";
import type { StorageUsage } from "@/lib/storage-quota";
import { getStorageUsage } from "@/lib/storage.functions";

const PERCENT = 100;
// Above this share of the quota, warn that uploads will soon be refused.
const WARNING_RATIO = 0.9;

const UsageSummary = ({ usage }: { usage: StorageUsage }) => {
  const { fileCount, quotaBytes, usedBytes } = usage;
  const files = `${formatCount(fileCount)} ${fileCount === 1 ? "file" : "files"}`;

  if (quotaBytes === null) {
    return (
      <p className="text-foreground text-sm">
        {formatBytes(usedBytes)} used by {files}. No storage limit is set (
        <code>STORAGE_QUOTA_BYTES</code>).
      </p>
    );
  }

  const ratio = quotaBytes === 0 ? 1 : Math.min(1, usedBytes / quotaBytes);
  const percent = Math.round(ratio * PERCENT);
  const isFull = usedBytes >= quotaBytes;

  return (
    <div className="grid gap-3">
      <label
        htmlFor="storage-usage"
        className="text-foreground text-sm font-medium"
      >
        {formatBytes(usedBytes)} of {formatBytes(quotaBytes)} used ({percent}
        %) by {files}
      </label>
      <progress
        id="storage-usage"
        value={percent}
        max={PERCENT}
        className="bg-muted [&::-moz-progress-bar]:bg-primary [&::-webkit-progress-bar]:bg-muted [&::-webkit-progress-value]:bg-primary h-2 w-full overflow-hidden rounded-full"
      >
        {percent}%
      </progress>
      {ratio >= WARNING_RATIO ? (
        <p role="alert" className="text-destructive text-sm">
          {isFull
            ? "The storage limit is reached. New uploads are refused until files are deleted or the limit is raised."
            : "Storage is almost full. Uploads that do not fit are refused."}
        </p>
      ) : null}
    </div>
  );
};

export const AdminStorage = () => {
  const [usage, setUsage] = useState<StorageUsage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setUsage(await getStorageUsage());
      } catch (loadError) {
        setError(errorMessage(loadError, "Could not load storage usage."));
      }
    };
    void load();
  }, []);

  return (
    <section aria-labelledby="storage-heading">
      <Card>
        <CardHeader>
          <h2
            id="storage-heading"
            className="text-foreground text-lg font-semibold"
          >
            File storage
          </h2>
        </CardHeader>

        <CardContent>
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          {!error && usage ? <UsageSummary usage={usage} /> : null}
          {!error && !usage ? (
            <Skeleton aria-busy="true" className="h-12 w-full" />
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
};
