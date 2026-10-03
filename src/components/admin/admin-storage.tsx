import { IconPhoto, IconStack2 } from "@tabler/icons-react";
import { useEffect, useState } from "react";

import { AlertDescription, AlertTitle, Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CardContent, CardHeader, Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { errorMessage } from "@/lib/form-errors";
import { formatBytes, formatCount } from "@/lib/format";
import type { StorageUsage } from "@/lib/storage-quota";
import { getStorageUsage } from "@/lib/storage.functions";

const PERCENT = 100;
// Above this share of the quota, warn that uploads will soon be refused.
const WARNING_RATIO = 0.9;

const plural = (count: number, noun: string) =>
  `${formatCount(count)} ${noun}${count === 1 ? "" : "s"}`;

/** Share of the bucket, 0-1. An absent limit is reported as 0 rather than guessed. */
const usageRatio = (usedBytes: number, quotaBytes: number | null): number => {
  if (quotaBytes === null) {
    return 0;
  }
  return quotaBytes === 0 ? 1 : Math.min(1, usedBytes / quotaBytes);
};

interface KindRowProps {
  bytes: number;
  count: number;
  icon: typeof IconPhoto;
  /** Heading for the row, e.g. "Files". */
  label: string;
  ratio: number;
  /** Lowercase singular used when counting, e.g. "file". */
  unit: string;
}

/**
 * One kind of stored object.
 *
 * The bar is relative to the whole bucket rather than to the total for that
 * kind, so the two rows are directly comparable and a single dominant row is
 * obvious at a glance.
 */
const KindRow = ({
  bytes,
  count,
  icon: Icon,
  label,
  ratio,
  unit,
}: KindRowProps) => {
  const share = ratio === 0 ? 0 : Math.round((bytes / ratio) * PERCENT);
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <span className="text-foreground flex items-center gap-2 text-sm font-medium">
          <Icon
            aria-hidden
            size={16}
            stroke={1.8}
            className="text-muted-foreground"
          />
          {label}
        </span>
        <span className="text-muted-foreground text-sm">
          {formatBytes(bytes)} · {plural(count, unit)}
        </span>
      </div>
      <div
        // Decorative: the headline figure and the bar beneath it already
        // carry the totals, and a second progressbar per row would repeat
        // them three times over for a screen reader.
        aria-hidden="true"
        className="bg-muted h-1.5 w-full overflow-hidden rounded-full"
      >
        <div
          className="bg-primary h-full rounded-full"
          style={{ width: `${Math.max(share, bytes > 0 ? 2 : 0)}%` }}
        />
      </div>
    </div>
  );
};

const NoLimit = () => (
  <p className="text-muted-foreground text-sm">
    No storage limit is set, so an upload only fails if the storage bucket
    itself rejects it. Set <code>STORAGE_QUOTA_BYTES</code> to cap usage.
  </p>
);

const QuotaWarning = ({ isFull }: { isFull: boolean }) => (
  <Alert variant="destructive">
    <AlertTitle>
      {isFull ? "Storage is full" : "Storage is almost full"}
    </AlertTitle>
    <AlertDescription>
      {isFull
        ? "New uploads are refused until objects are deleted or the limit is raised."
        : "Uploads that do not fit are refused."}
    </AlertDescription>
  </Alert>
);

const UsageSummary = ({ usage }: { usage: StorageUsage }) => {
  const {
    fileBytes,
    fileCount,
    imageBytes,
    imageCount,
    quotaBytes,
    usedBytes,
  } = usage;

  const hasLimit = quotaBytes !== null;
  const ratio = usageRatio(usedBytes, quotaBytes);
  const percent = Math.round(ratio * PERCENT);
  const isFull = hasLimit && usedBytes >= quotaBytes;

  return (
    <div className="grid gap-8">
      {/* The headline is the one number an admin came here for, so it is set
          at display size rather than being buried in a sentence. */}
      <div className="grid gap-1">
        <p className="text-foreground text-4xl font-bold tracking-tight">
          {formatBytes(usedBytes)}
        </p>
        <p className="text-muted-foreground text-sm">
          {hasLimit ? (
            <>
              of {formatBytes(quotaBytes)} used ({percent}%)
            </>
          ) : (
            <>stored so far. No limit is set.</>
          )}
        </p>
      </div>

      {hasLimit ? (
        <div className="grid gap-2">
          <label htmlFor="storage-usage" className="sr-only">
            Storage used, {percent} percent of the limit
          </label>
          <progress
            id="storage-usage"
            value={percent}
            max={PERCENT}
            className="bg-muted [&::-moz-progress-bar]:bg-primary [&::-webkit-progress-bar]:bg-muted [&::-webkit-progress-value]:bg-primary h-2 w-full overflow-hidden rounded-full"
          >
            {percent}%
          </progress>
        </div>
      ) : (
        <NoLimit />
      )}

      <div className="grid gap-4">
        <h3 className="text-foreground text-sm font-semibold">
          What is using it
        </h3>
        <KindRow
          bytes={fileBytes}
          count={fileCount}
          icon={IconStack2}
          label="Files"
          unit="file"
          ratio={hasLimit ? quotaBytes : usedBytes}
        />
        <KindRow
          bytes={imageBytes}
          count={imageCount}
          icon={IconPhoto}
          label="Images"
          unit="image"
          ratio={hasLimit ? quotaBytes : usedBytes}
        />
        {imageBytes > fileBytes ? (
          <p className="text-muted-foreground text-sm">
            Images are the larger share. They are stored exactly as uploaded, so
            a few large photos can dominate the bucket.
          </p>
        ) : null}
      </div>

      {ratio >= WARNING_RATIO && hasLimit ? (
        <QuotaWarning isFull={isFull} />
      ) : null}
    </div>
  );
};

export const AdminStorage = () => {
  const [usage, setUsage] = useState<StorageUsage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchUsage = async () => {
    try {
      setUsage(await getStorageUsage());
      setError(null);
    } catch (loadError) {
      setUsage(null);
      setError(errorMessage(loadError, "Could not load storage usage."));
    }
  };

  /**
   * A user-triggered reload. Separate from the mount effect so that setting
   * `isRefreshing` cannot happen inside it.
   */
  const refresh = async () => {
    setIsRefreshing(true);
    await fetchUsage();
    setIsRefreshing(false);
  };

  useEffect(() => {
    // The guard keeps a slow response from setting state after unmount, and
    // keeps the setState calls out of the synchronous part of the effect.
    let isCurrent = true;

    const loadOnMount = async () => {
      try {
        const loaded = await getStorageUsage();
        if (isCurrent) {
          setUsage(loaded);
          setError(null);
        }
      } catch (loadError) {
        if (isCurrent) {
          setUsage(null);
          setError(errorMessage(loadError, "Could not load storage usage."));
        }
      }
    };
    void loadOnMount();

    return () => {
      isCurrent = false;
    };
  }, []);

  return (
    <section aria-labelledby="storage-heading">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="grid gap-1">
              <h2
                id="storage-heading"
                className="text-foreground text-lg font-semibold"
              >
                Storage used
              </h2>
              <p className="text-muted-foreground text-sm">
                Everything the site keeps in its storage bucket, and how close
                it is to the limit.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-11"
              disabled={isRefreshing}
              onClick={refresh}
            >
              {isRefreshing ? "Refreshing…" : "Refresh"}
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {error ? (
            <Alert variant="destructive">
              <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
                <span>{error}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="min-h-11"
                  onClick={refresh}
                >
                  Try again
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}
          {!error && usage ? <UsageSummary usage={usage} /> : null}
          {!error && !usage ? (
            <div aria-busy="true" className="grid gap-4">
              <Skeleton className="h-10 w-40" />
              <Skeleton className="h-2 w-full" />
              <Skeleton className="h-4 w-64" />
            </div>
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
};
