import { createServerFn } from "@tanstack/react-start";

import { requireStaff } from "@/lib/role-guards";
import { loadStorageConfig } from "@/lib/storage";
import { getUsedBytes } from "@/lib/storage-quota";
import type { StorageUsage } from "@/lib/storage-quota";

/** Storage used by uploaded files and the configured quota (admins only). */
export const getStorageUsage = createServerFn({ method: "GET" }).handler(
  async (): Promise<StorageUsage> => {
    // Site-wide usage, so it stays admin-only rather than moderator-readable.
    await requireStaff("admin");
    const { fileCount, imageCount, usedBytes } = await getUsedBytes();
    return {
      fileCount,
      imageCount,
      quotaBytes: loadStorageConfig().quotaBytes,
      usedBytes,
    };
  }
);
