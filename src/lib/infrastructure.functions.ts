import { createServerFn } from "@tanstack/react-start";

import { requireCapability } from "@/lib/role-guards";
import { loadStorageConfig } from "@/lib/storage";
import { getValkey, isValkeyConfigured, isValkeyReady } from "@/lib/valkey";

export interface InfrastructureStatus {
  /** No VALKEY_URL in production: rate limits cannot be shared. */
  redisConfigured: boolean;
  /** A connection could be established; false when unconfigured or down. */
  redisReady: boolean;
  /** S3-compatible object storage has all required settings. */
  storageConfigured: boolean;
}

const storageIsConfigured = (): boolean => {
  try {
    loadStorageConfig();

    return true;
  } catch {
    return false;
  }
};

const redisStatus = async (): Promise<{
  redisConfigured: boolean;
  redisReady: boolean;
}> => {
  if (!isValkeyConfigured()) {
    return { redisConfigured: false, redisReady: false };
  }

  try {
    // Connecting here also warms the shared client, so the banner reflects a
    // real connection rather than an env var that points at a dead host.
    await getValkey();

    return { redisConfigured: true, redisReady: isValkeyReady() };
  } catch {
    return { redisConfigured: true, redisReady: false };
  }
};

/**
 * Backs the admin-only warnings about degraded infrastructure.
 *
 * A regular browse page never asks this question: EventSource failures stay
 * silent for visitors, and configuration details are not theirs to see. The
 * capability check keeps the answer to admins.
 */
export const getInfrastructureStatus = createServerFn({
  method: "GET",
}).handler(async (): Promise<InfrastructureStatus> => {
  await requireCapability("manageStorage");

  return {
    ...(await redisStatus()),
    storageConfigured: storageIsConfigured(),
  };
});
