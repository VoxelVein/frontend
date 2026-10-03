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
    const {
      avatarBytes,
      avatarCount,
      fileBytes,
      fileCount,
      imageBytes,
      imageCount,
      usedBytes,
    } = await getUsedBytes();
    return {
      avatarBytes,
      avatarCount,
      fileBytes,
      fileCount,
      imageBytes,
      imageCount,
      quotaBytes: loadStorageConfig().quotaBytes,
      usedBytes,
    };
  }
);

/**
 * Whether object storage is configured on this deployment.
 *
 * Read through a server function rather than from the client env, because
 * `env.config.ts` throws when it is imported in a browser bundle — the storage
 * secrets have no business in one, and the question is about the *server's*
 * configuration, not the browser's.
 *
 * Reports a boolean rather than throwing. This runs on ordinary page loads to
 * decide whether upload controls are usable, and a function that threw for the
 * normal "storage is off" case would force every caller into a try/catch to
 * tell "off" apart from "broken".
 */
export const storageIsConfigured = createServerFn({
  method: "GET",
}).handler((): boolean => {
  try {
    loadStorageConfig();
    return true;
  } catch {
    // Every failure here is a misconfiguration as far as the UI is concerned:
    // the upload controls must stay disabled either way.
    return false;
  }
});
