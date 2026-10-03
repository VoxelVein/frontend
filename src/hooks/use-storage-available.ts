import { useQuery } from "@tanstack/react-query";

import { storageIsConfigured } from "@/lib/storage.functions";

const STORAGE_QUERY_KEY = ["storage", "configured"] as const;

/**
 * Whether this deployment has object storage configured.
 *
 * Drives whether upload controls are offered at all, so the answer is fetched
 * once per session and then cached: storage configuration cannot change under a
 * running browser, and re-asking on every page would be a round-trip for an
 * answer that is always the same.
 *
 * **Fails open.** A failed check reports "available", so the controls stay
 * enabled and the action is sent. The server then refuses it and the reader is
 * told what happened, which is a better outcome than a permanently greyed-out
 * upload button on a site whose storage is perfectly fine — the failure mode of
 * a cached `false` is that it never expires.
 */
export const useStorageAvailable = () => {
  const { data, isPending } = useQuery({
    queryFn: storageIsConfigured,
    queryKey: STORAGE_QUERY_KEY,
    staleTime: Number.POSITIVE_INFINITY,
  });

  return {
    isAvailable: data ?? true,
    isKnown: !isPending,
  };
};
