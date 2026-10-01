import { createServerFn } from "@tanstack/react-start";

import { requireCapability } from "@/lib/role-guards";
import { loadStorageConfig } from "@/lib/storage";
import { getUsedBytes } from "@/lib/storage-quota";
import type { StorageUsage } from "@/lib/storage-quota";

/** Storage used by uploaded files and the configured quota (admins only). */
export const getStorageUsage = createServerFn({ method: "GET" }).handler(
  async (): Promise<StorageUsage> => {
    // Site-wide usage, so it stays admin-only rather than moderator-readable.
    await requireCapability("manageStorage");
    const { fileBytes, fileCount, imageBytes, imageCount, usedBytes } =
      await getUsedBytes();
    return {
      fileBytes,
      fileCount,
      imageBytes,
      imageCount,
      quotaBytes: loadStorageConfig().quotaBytes,
      usedBytes,
    };
  }
);
