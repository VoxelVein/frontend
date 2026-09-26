import { randomInt } from "node:crypto";

import { and, eq, gt, inArray, isNotNull, lte, ne } from "drizzle-orm";

import { db } from "@/db";
import {
  adminNotifications,
  projectFiles,
  projects,
  projectVersions,
  sessions,
  usernameHistory,
  users,
} from "@/db/schema";
import { syncProjectToSearch } from "@/lib/search-sync";
import { deleteObjects } from "@/lib/storage";
import {
  getNextUsernameChange,
  getUsernameProblem,
  normalizeUsername,
  toUsernameBase,
  USERNAME_PROBLEM_MESSAGES,
  USERNAME_RESERVATION_MS,
  withUsernameSuffix,
} from "@/lib/usernames";

const DAY_IN_MS = 24 * 60 * 60 * 1000;

/** How long a scheduled deletion can still be undone by an admin. */
export const ACCOUNT_DELETION_GRACE_MS = 14 * DAY_IN_MS;

/** Ban reason that marks an account as scheduled for deletion. */
export const PENDING_DELETION_BAN_REASON = "pending-deletion";

const SUFFIX_ATTEMPTS = 20;
const SUFFIX_MAX = 10_000;
const SUFFIX_DIGITS = 4;

// ---------------------------------------------------------------------------
// Usernames
// ---------------------------------------------------------------------------

/**
 * True when nobody else holds the name, either as their current username or
 * as a recently given-up one that is still reserved for them.
 */
export const isUsernameFree = async (
  username: string,
  exceptUserId?: string
): Promise<boolean> => {
  const name = normalizeUsername(username);
  const [current] = await db
    .select({ id: users.id })
    .from(users)
    .where(
      exceptUserId
        ? and(eq(users.username, name), ne(users.id, exceptUserId))
        : eq(users.username, name)
    )
    .limit(1);
  if (current) {
    return false;
  }

  const [reserved] = await db
    .select({ id: usernameHistory.id })
    .from(usernameHistory)
    .where(
      and(
        eq(usernameHistory.username, name),
        gt(usernameHistory.expiresAt, new Date()),
        exceptUserId ? ne(usernameHistory.userId, exceptUserId) : undefined
      )
    )
    .limit(1);
  return !reserved;
};

export type UsernameCheck =
  | { available: true }
  | { available: false; message: string };

/** Format, reserved-name, and availability check for one user. */
export const checkUsernameFor = async (
  username: string,
  userId?: string
): Promise<UsernameCheck> => {
  const problem = getUsernameProblem(username);
  if (problem) {
    return { available: false, message: USERNAME_PROBLEM_MESSAGES[problem] };
  }
  if (!(await isUsernameFree(username, userId))) {
    return { available: false, message: "This username is already taken." };
  }
  return { available: true };
};

/** The first candidate nobody holds, checked with two queries in total. */
const firstFreeUsername = async (
  candidates: string[]
): Promise<string | null> => {
  if (candidates.length === 0) {
    return null;
  }
  const [current, reserved] = await Promise.all([
    db
      .select({ username: users.username })
      .from(users)
      .where(inArray(users.username, candidates)),
    db
      .select({ username: usernameHistory.username })
      .from(usernameHistory)
      .where(
        and(
          inArray(usernameHistory.username, candidates),
          gt(usernameHistory.expiresAt, new Date())
        )
      ),
  ]);
  const taken = new Set(
    [...current, ...reserved].map(({ username }) => username)
  );
  return candidates.find((candidate) => !taken.has(candidate)) ?? null;
};

const syncProjectsToSearch = async (projectIds: string[]): Promise<void> => {
  await Promise.all(projectIds.map((id) => syncProjectToSearch(id)));
};

/**
 * Picks a free username from a hint (a GitHub login, an email local part, or
 * a name), adding a random numeric suffix when the plain form is taken.
 */
export const findAvailableUsername = async (
  hints: (string | null | undefined)[]
): Promise<string> => {
  const bases = [
    ...new Set(
      hints
        .filter((hint): hint is string => Boolean(hint?.trim()))
        .map(toUsernameBase)
    ),
  ];
  if (bases.length === 0) {
    bases.push("user");
  }

  const plain = await firstFreeUsername(
    bases.filter((base) => !getUsernameProblem(base))
  );
  if (plain) {
    return plain;
  }

  const [base = "user"] = bases;
  const suffixed = await firstFreeUsername(
    Array.from({ length: SUFFIX_ATTEMPTS }, () =>
      withUsernameSuffix(
        base,
        randomInt(SUFFIX_MAX).toString().padStart(SUFFIX_DIGITS, "0")
      )
    )
  );
  if (!suffixed) {
    throw new Error("Could not find a free username.");
  }
  return suffixed;
};

/**
 * Maps a username that was given up within the reservation window to its
 * owner's current username, so the old name keeps signing them in.
 */
export const resolveReservedUsername = async (
  username: string
): Promise<string | null> => {
  const name = normalizeUsername(username);
  const [current] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, name))
    .limit(1);
  if (current) {
    return null;
  }

  const [entry] = await db
    .select({ username: users.username })
    .from(usernameHistory)
    .innerJoin(users, eq(users.id, usernameHistory.userId))
    .where(
      and(
        eq(usernameHistory.username, name),
        gt(usernameHistory.expiresAt, new Date())
      )
    )
    .limit(1);
  return entry?.username ?? null;
};

export class AccountError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AccountError";
  }
}

interface UsernameOwner {
  id: string;
  username: string | null;
  usernameChangedAt: Date | null;
  usernameConfirmed: boolean;
}

const loadUsernameOwner = async (userId: string): Promise<UsernameOwner> => {
  const [user] = await db
    .select({
      id: users.id,
      username: users.username,
      usernameChangedAt: users.usernameChangedAt,
      usernameConfirmed: users.usernameConfirmed,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) {
    throw new AccountError("Account not found.");
  }
  return user;
};

/**
 * First-time choice on /welcome for accounts created through Google or
 * GitHub. It does not start the change cooldown and reserves nothing, since
 * the generated name was never really in use.
 */
export const confirmUsername = async (
  userId: string,
  requested: string
): Promise<string> => {
  const user = await loadUsernameOwner(userId);
  if (user.usernameConfirmed) {
    throw new AccountError("Your username is already set.");
  }
  const check = await checkUsernameFor(requested, userId);
  if (!check.available) {
    throw new AccountError(check.message);
  }

  const username = normalizeUsername(requested);
  await db
    .update(users)
    .set({
      displayUsername: requested.trim(),
      username,
      usernameConfirmed: true,
    })
    .where(eq(users.id, userId));
  return username;
};

/**
 * Self-service change from settings. Locks the username for the cooldown
 * and keeps the old one reserved (and usable for sign-in) meanwhile.
 */
export const changeUsername = async (
  userId: string,
  requested: string
): Promise<string> => {
  const user = await loadUsernameOwner(userId);
  if (!user.usernameConfirmed) {
    throw new AccountError("Choose your username first.");
  }
  const username = normalizeUsername(requested);
  if (username === user.username) {
    // Only the capitalisation changed: no new name, so no cooldown.
    await db
      .update(users)
      .set({ displayUsername: requested.trim() })
      .where(eq(users.id, userId));
    return username;
  }

  const nextChange = getNextUsernameChange(user.usernameChangedAt);
  if (nextChange) {
    throw new AccountError(
      `You can change your username again on ${nextChange.toISOString().slice(0, 10)}.`
    );
  }
  const check = await checkUsernameFor(requested, userId);
  if (!check.available) {
    throw new AccountError(check.message);
  }

  const now = new Date();
  await db.transaction(async (tx) => {
    // Taking back one of your own reserved names ends that reservation.
    await tx
      .delete(usernameHistory)
      .where(
        and(
          eq(usernameHistory.userId, userId),
          eq(usernameHistory.username, username)
        )
      );
    if (user.username) {
      await tx.insert(usernameHistory).values({
        expiresAt: new Date(now.getTime() + USERNAME_RESERVATION_MS),
        userId,
        username: user.username,
      });
    }
    await tx
      .update(users)
      .set({
        displayUsername: requested.trim(),
        username,
        usernameChangedAt: now,
      })
      .where(eq(users.id, userId));
  });
  return username;
};

// ---------------------------------------------------------------------------
// Admin notifications
// ---------------------------------------------------------------------------

interface AdminNotificationInput {
  message: string;
  projectId?: string;
  title: string;
  type: string;
  userId?: string;
}

export const notifyAdmins = async (
  notifications: AdminNotificationInput[]
): Promise<void> => {
  if (notifications.length === 0) {
    return;
  }
  await db.insert(adminNotifications).values(notifications);
};

// ---------------------------------------------------------------------------
// Account deletion
// ---------------------------------------------------------------------------

export interface OwnedProject {
  id: string;
  isProtected: boolean;
  name: string;
  slug: string;
  status: string;
}

export const listOwnedProjects = (userId: string): Promise<OwnedProject[]> =>
  db
    .select({
      id: projects.id,
      isProtected: projects.isProtected,
      name: projects.name,
      slug: projects.slug,
      status: projects.status,
    })
    .from(projects)
    .where(eq(projects.ownerId, userId))
    .orderBy(projects.name);

/** Deletes projects with their versions, stored files, and search entries. */
const deleteProjectsCompletely = async (projectIds: string[]) => {
  if (projectIds.length === 0) {
    return;
  }
  const versionIds = db
    .select({ id: projectVersions.id })
    .from(projectVersions)
    .where(inArray(projectVersions.projectId, projectIds));
  const files = await db
    .select({ storageKey: projectFiles.storageKey })
    .from(projectFiles)
    .where(inArray(projectFiles.versionId, versionIds));

  await db.delete(projects).where(inArray(projects.id, projectIds));
  if (files.length > 0) {
    try {
      await deleteObjects(files.map((file) => file.storageKey));
    } catch (error) {
      // The rows are gone either way; leftover objects only cost storage
      // and must not keep the account from being deleted.
      console.error("Could not delete stored files of deleted projects", error);
    }
  }
  await syncProjectsToSearch(projectIds);
};

/**
 * Permanently removes an account. Projects marked for deletion go with it;
 * every other project stays, without an owner.
 */
export const purgeAccount = async (userId: string): Promise<void> => {
  const owned = await db
    .select({ id: projects.id, pendingDeletion: projects.pendingDeletion })
    .from(projects)
    .where(eq(projects.ownerId, userId));

  const doomed: string[] = [];
  const kept: string[] = [];
  for (const project of owned) {
    (project.pendingDeletion ? doomed : kept).push(project.id);
  }

  await deleteProjectsCompletely(doomed);

  // Sessions, sign-in accounts, passkeys, and username reservations cascade;
  // kept projects lose their owner through `on delete set null`.
  await db.delete(users).where(eq(users.id, userId));

  // Kept projects now show "Deleted user" as their author.
  await syncProjectsToSearch(kept);
};

export type DeletionResult =
  | { status: "deleted" }
  | { purgeAt: string; status: "scheduled" };

interface DeletionRequest {
  /** Projects the owner wants to keep. Protected projects are always kept. */
  keepProjectIds: string[];
  userId: string;
  username: string | null;
}

/**
 * Deletes the account right away when it never owned a project. Otherwise
 * schedules it: the account is banned and signed out everywhere, projects
 * chosen for deletion disappear, and admins hear about protected projects.
 */
export const requestAccountDeletion = async ({
  keepProjectIds,
  userId,
  username,
}: DeletionRequest): Promise<DeletionResult> => {
  const [user] = await db
    .select({
      deletionRequestedAt: users.deletionRequestedAt,
      hasOwnedProject: users.hasOwnedProject,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) {
    throw new AccountError("Account not found.");
  }
  if (user.deletionRequestedAt) {
    throw new AccountError("This account is already scheduled for deletion.");
  }

  const owned = await listOwnedProjects(userId);
  if (!user.hasOwnedProject && owned.length === 0) {
    await purgeAccount(userId);
    return { status: "deleted" };
  }

  const keep = new Set(keepProjectIds);
  const toDelete: string[] = [];
  const protectedProjects: OwnedProject[] = [];
  for (const project of owned) {
    if (project.isProtected) {
      protectedProjects.push(project);
    } else if (!keep.has(project.id)) {
      toDelete.push(project.id);
    }
  }

  const now = new Date();
  const purgeAt = new Date(now.getTime() + ACCOUNT_DELETION_GRACE_MS);
  const purgeDate = purgeAt.toISOString().slice(0, 10);
  const who = username ? `@${username}` : "A user";

  await db.transaction(async (tx) => {
    if (toDelete.length > 0) {
      await tx
        .update(projects)
        .set({ pendingDeletion: true })
        .where(inArray(projects.id, toDelete));
    }
    await tx
      .update(users)
      .set({
        banExpires: null,
        banReason: PENDING_DELETION_BAN_REASON,
        banned: true,
        deletionRequestedAt: now,
      })
      .where(eq(users.id, userId));
    await tx.delete(sessions).where(eq(sessions.userId, userId));
  });

  await syncProjectsToSearch(toDelete);

  await notifyAdmins(
    protectedProjects.map((project) => ({
      message: `${who} requested account deletion. "${project.name}" is a protected project, so it is kept without an owner when the account is deleted on ${purgeDate}.`,
      projectId: project.id,
      title: `Protected project "${project.name}" is losing its owner`,
      type: "protected-project-orphaned",
      userId,
    }))
  );

  return { purgeAt: purgeAt.toISOString(), status: "scheduled" };
};

/** Admin undo of a scheduled deletion, within the grace period. */
export const restoreAccount = async (userId: string): Promise<void> => {
  const [user] = await db
    .select({ deletionRequestedAt: users.deletionRequestedAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user?.deletionRequestedAt) {
    throw new AccountError("This account is not scheduled for deletion.");
  }

  const hidden = await db
    .update(projects)
    .set({ pendingDeletion: false })
    .where(
      and(eq(projects.ownerId, userId), eq(projects.pendingDeletion, true))
    )
    .returning({ id: projects.id });
  await db
    .update(users)
    .set({
      banExpires: null,
      banReason: null,
      banned: false,
      deletionRequestedAt: null,
    })
    .where(eq(users.id, userId));

  await syncProjectsToSearch(hidden.map(({ id }) => id));
};

export interface PendingDeletion {
  deletionRequestedAt: string;
  email: string;
  id: string;
  keptProjects: number;
  name: string;
  projectsToDelete: number;
  purgeAt: string;
  username: string | null;
}

export const listPendingDeletions = async (): Promise<PendingDeletion[]> => {
  const pending = await db
    .select({
      deletionRequestedAt: users.deletionRequestedAt,
      email: users.email,
      id: users.id,
      name: users.name,
      username: users.username,
    })
    .from(users)
    .where(isNotNull(users.deletionRequestedAt))
    .orderBy(users.deletionRequestedAt);
  if (pending.length === 0) {
    return [];
  }

  const owned = await db
    .select({
      ownerId: projects.ownerId,
      pendingDeletion: projects.pendingDeletion,
    })
    .from(projects)
    .where(
      inArray(
        projects.ownerId,
        pending.map(({ id }) => id)
      )
    );

  return pending.map((user) => {
    const requestedAt = user.deletionRequestedAt ?? new Date();
    const mine = owned.filter((project) => project.ownerId === user.id);
    const projectsToDelete = mine.filter(
      (project) => project.pendingDeletion
    ).length;
    return {
      deletionRequestedAt: requestedAt.toISOString(),
      email: user.email,
      id: user.id,
      keptProjects: mine.length - projectsToDelete,
      name: user.name,
      projectsToDelete,
      purgeAt: new Date(
        requestedAt.getTime() + ACCOUNT_DELETION_GRACE_MS
      ).toISOString(),
      username: user.username,
    };
  });
};

/** Purges every account whose grace period has ended. Returns the count. */
export const purgeExpiredAccounts = async (
  now: Date = new Date()
): Promise<number> => {
  const cutoff = new Date(now.getTime() - ACCOUNT_DELETION_GRACE_MS);
  const expired = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        isNotNull(users.deletionRequestedAt),
        lte(users.deletionRequestedAt, cutoff)
      )
    );

  const results = await Promise.allSettled(
    expired.map(({ id }) => purgeAccount(id))
  );
  let purged = 0;
  for (const [index, result] of results.entries()) {
    if (result.status === "fulfilled") {
      purged += 1;
    } else {
      // Retried on the next run; one failure must not block the others.
      console.error(
        `Could not purge account ${expired[index]?.id}`,
        result.reason
      );
    }
  }
  return purged;
};

/** Removes username reservations that have run out. */
export const pruneUsernameHistory = async (
  now: Date = new Date()
): Promise<void> => {
  await db.delete(usernameHistory).where(lte(usernameHistory.expiresAt, now));
};
