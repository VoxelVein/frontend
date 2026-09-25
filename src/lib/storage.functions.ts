import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";

import { auth } from "@/lib/auth";
import { loadStorageConfig } from "@/lib/storage";
import { getUsedBytes } from "@/lib/storage-quota";
import type { StorageUsage } from "@/lib/storage-quota";

/** Storage used by uploaded files and the configured quota (admins only). */
export const getStorageUsage = createServerFn({ method: "GET" }).handler(
  async (): Promise<StorageUsage> => {
    const session = await auth.api.getSession({
      headers: getRequestHeaders(),
    });
    if (session?.user.role !== "admin") {
      throw new Error("Unauthorized");
    }
    const { fileCount, usedBytes } = await getUsedBytes();
    return { fileCount, quotaBytes: loadStorageConfig().quotaBytes, usedBytes };
  }
);
