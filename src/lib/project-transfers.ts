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

/** The instant an offer made at `createdAt` stops being answerable. */
export const transferExpiresAt = (createdAt: Date): Date =>
  new Date(createdAt.getTime() + PROJECT_TRANSFER_EXPIRY_MS);

/** An offer stays answerable up to, but not including, its expiry instant. */
export const isTransferExpired = (
  expiresAt: Date,
  now: Date = new Date()
): boolean => expiresAt.getTime() <= now.getTime();

export const isTransferStatus = (
  value: unknown
): value is ProjectTransferStatus =>
  PROJECT_TRANSFER_STATUSES.some((status) => status === value);
