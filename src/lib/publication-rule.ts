/**
 * When a draft has to be looked at by a person before it goes public.
 *
 * Separated from `project-moderation.ts` — which reaches the database — so the
 * policy can be read and tested on its own. The rule is two stored timestamps
 * and one boolean, and it is the part worth pinning down: it decides whether
 * someone gets a listing or a queue.
 */

/** The stored state the rule reads. */
interface PublicationHistory {
  /**
   * When the project was first made public.
   *
   * Preserved across an owner unpublishing, so a null here means "has never
   * been live" and a value means "has been live at least once".
   */
  publishedAt: Date | string | null;
  /**
   * When staff last took it down, if they ever did.
   *
   * Survives every owner action, and is cleared by a staff approval.
   */
  takenDownAt: Date | string | null;
}

/**
 * Whether publishing this project needs a moderator.
 *
 * A project the owner unpublished goes straight back up. Withdrawing your own
 * listing is not a moderation event, and making someone queue for review to undo
 * a decision they just made would put the review step in charge of a self-service
 * action — and make "unpublish then publish again" a slow round trip for no
 * reason.
 *
 * A project staff took down goes into the queue, whatever its history
 * otherwise says. Putting it back up is exactly what that judgement was for, so
 * the takedown overrides "it was fine last time".
 */
export const needsReview = ({
  publishedAt,
  takenDownAt,
}: PublicationHistory): boolean => publishedAt === null || takenDownAt !== null;
