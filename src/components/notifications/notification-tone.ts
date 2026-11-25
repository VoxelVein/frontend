import {
  IconCircleCheck,
  IconInfoCircle,
  IconMessageReport,
} from "@tabler/icons-react";

import type { NotificationTone } from "@/lib/notifications";

/**
 * Icon and tint per notification tone.
 *
 * Both the bell's tile and the inbox row use these, so an approval cannot look
 * different between the two views. Kept in a non-component module so Fast
 * Refresh can still preserve state in the row components that import it.
 */
export const TONE_ICON = {
  attention: IconMessageReport,
  neutral: IconInfoCircle,
  positive: IconCircleCheck,
} as const satisfies Record<NotificationTone, typeof IconInfoCircle>;

export const TONE_CLASS = {
  attention: "bg-destructive/10 text-destructive",
  neutral: "bg-muted text-muted-foreground",
  positive: "bg-primary/10 text-primary",
} as const satisfies Record<NotificationTone, string>;
