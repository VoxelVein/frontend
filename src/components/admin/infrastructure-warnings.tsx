import { IconDatabase, IconServer } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getInfrastructureStatus } from "@/lib/infrastructure.functions";

/**
 * Persistent warnings for the services an admin can actually do something
 * about.
 *
 * Visitors never see these checks. A dropped SSE stream stays silent on a
 * browse page because browsing still works; only the admin dashboard reports
 * that caching or file storage is misconfigured. The query is cached for a
 * minute so navigating between admin tabs does not re-probe the services.
 */
const InfrastructureWarnings = () => {
  const { data } = useQuery({
    queryFn: () => getInfrastructureStatus(),
    queryKey: ["admin-infrastructure-status"],
    retry: false,
    staleTime: 60_000,
  });

  if (!data) {
    return null;
  }

  let redisProblem: string | null = null;

  if (!data.redisConfigured) {
    redisProblem =
      "Redis (Valkey) is not configured. Set VALKEY_URL to enable shared rate limits, caching, and live updates.";
  } else if (!data.redisReady) {
    redisProblem =
      "Redis (Valkey) is configured but disconnected. Shared rate limits, caching, and live updates are disabled until it is reachable.";
  }

  const storageProblem = data.storageConfigured
    ? null
    : "S3-compatible object storage is not configured. File, image, and avatar uploads may fail or fall back to local storage.";

  if (!(redisProblem || storageProblem)) {
    return null;
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
      <div aria-label="Infrastructure warnings" className="grid gap-3">
        {redisProblem ? (
          <Alert variant="destructive">
            <IconServer aria-hidden="true" />
            <AlertTitle>Cache and live updates are unavailable</AlertTitle>
            <AlertDescription>{redisProblem}</AlertDescription>
          </Alert>
        ) : null}
        {storageProblem ? (
          <Alert variant="destructive">
            <IconDatabase aria-hidden="true" />
            <AlertTitle>File storage is unavailable</AlertTitle>
            <AlertDescription>{storageProblem}</AlertDescription>
          </Alert>
        ) : null}
      </div>
    </div>
  );
};

export { InfrastructureWarnings };
