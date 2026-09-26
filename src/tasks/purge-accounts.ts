import { defineTask } from "nitro/task";

import {
  pruneUsernameHistory,
  purgeExpiredAccounts,
} from "@/lib/account-lifecycle";

/**
 * Permanently deletes accounts whose 14-day deletion grace period has ended
 * and drops expired username reservations. Scheduled in vite.config.ts.
 */
export default defineTask({
  meta: {
    description: "Purge accounts past their deletion grace period",
    name: "accounts:purge",
  },
  run: async () => {
    const purged = await purgeExpiredAccounts();
    await pruneUsernameHistory();
    return { result: { purged } };
  },
});
