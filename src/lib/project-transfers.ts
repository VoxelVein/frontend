/** Vocabulary shared by the database schema, server functions and the UI. */

export const PROJECT_TRANSFER_STATUSES = [
  "pending",
  "accepted",
  "declined",
  "cancelled",
] as const;

export type ProjectTransferStatus = (typeof PROJECT_TRANSFER_STATUSES)[number];

/** How long a recipient has to answer an offered transfer. */
export const PROJECT_TRANSFER_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;
