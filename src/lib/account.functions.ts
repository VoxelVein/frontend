import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { and, eq } from "drizzle-orm";
import {
  array,
  maxLength,
  minLength,
  object,
  optional,
  parse,
  pipe,
  string,
  uuid,
} from "valibot";

import { db } from "@/db";
import { accounts } from "@/db/schema";
import {
  AccountError,
  changeUsername as changeUsernameFor,
  checkUsernameFor,
  confirmUsername as confirmUsernameFor,
  findAvailableUsername,
  listOwnedProjects,
  requestAccountDeletion,
} from "@/lib/account-lifecycle";
import type {
  DeletionResult,
  OwnedProject,
  UsernameCheck,
} from "@/lib/account-lifecycle";
import { auth } from "@/lib/auth";
import type { Session } from "@/lib/project-access";
import { normalizeUsername, USERNAME_MAX_LENGTH } from "@/lib/usernames";

/** How recently the user must have signed in to delete their account. */
export const REAUTH_WINDOW_MS = 10 * 60 * 1000;

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

const requireSession = async (): Promise<Session> => {
  const session = await auth.api.getSession({ headers: getRequestHeaders() });
  if (!session) {
    throw new AccountError("Sign in to manage your account.");
  }
  return session;
};

const hasCredentialAccount = async (userId: string): Promise<boolean> => {
  const [credential] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(
      and(eq(accounts.userId, userId), eq(accounts.providerId, "credential"))
    )
    .limit(1);
  return Boolean(credential);
};

const verifyPassword = async (
  userId: string,
  password: string
): Promise<boolean> => {
  const [credential] = await db
    .select({ password: accounts.password })
    .from(accounts)
    .where(
      and(eq(accounts.userId, userId), eq(accounts.providerId, "credential"))
    )
    .limit(1);
  if (!credential?.password) {
    return false;
  }
  const context = await auth.$context;
  return context.password.verify({ hash: credential.password, password });
};

const reauthenticatedUntil = (session: Session): Date =>
  new Date(new Date(session.session.createdAt).getTime() + REAUTH_WINDOW_MS);

// ---------------------------------------------------------------------------
// Account deletion
// ---------------------------------------------------------------------------

export interface AccountDeletionContext {
  hasPassword: boolean;
  /** Delete right away, or schedule with the 14-day grace period. */
  mode: "immediate" | "scheduled";
  projects: OwnedProject[];
  /** Until when the current session counts as freshly signed in. */
  reauthenticatedUntil: string | null;
  username: string | null;
}

export const getAccountDeletionContext = createServerFn({
  method: "GET",
}).handler(async (): Promise<AccountDeletionContext> => {
  const session = await requireSession();
  const [projects, hasPassword] = await Promise.all([
    listOwnedProjects(session.user.id),
    hasCredentialAccount(session.user.id),
  ]);
  const until = reauthenticatedUntil(session);

  return {
    hasPassword,
    mode:
      session.user.hasOwnedProject || projects.length > 0
        ? "scheduled"
        : "immediate",
    projects,
    reauthenticatedUntil: until > new Date() ? until.toISOString() : null,
    username: session.user.username ?? null,
  };
});

const deleteAccountSchema = object({
  confirmation: pipe(string(), maxLength(USERNAME_MAX_LENGTH)),
  keepProjectIds: array(pipe(string(), uuid())),
  password: optional(pipe(string(), maxLength(MAX_PASSWORD_LENGTH))),
});

export const deleteAccount = createServerFn({ method: "POST" })
  .validator(
    (data: {
      confirmation: string;
      keepProjectIds: string[];
      password?: string;
    }) => parse(deleteAccountSchema, data)
  )
  .handler(async ({ data }): Promise<DeletionResult> => {
    const session = await requireSession();
    if (session.session.impersonatedBy) {
      throw new AccountError("Stop impersonating before deleting accounts.");
    }

    // Re-verification: the password, or a sign-in within the last minutes
    // (passkey, Google, or GitHub). A stolen long-lived cookie is not enough.
    const verified = data.password
      ? await verifyPassword(session.user.id, data.password)
      : reauthenticatedUntil(session) > new Date();
    if (!verified) {
      throw new AccountError(
        data.password
          ? "That password is not correct."
          : "Confirm it's you again before deleting your account."
      );
    }

    const expected = session.user.username ?? session.user.email;
    if (normalizeUsername(data.confirmation) !== normalizeUsername(expected)) {
      throw new AccountError(`Type ${expected} to confirm.`);
    }

    return requestAccountDeletion({
      keepProjectIds: data.keepProjectIds,
      userId: session.user.id,
      username: session.user.username ?? null,
    });
  });

// ---------------------------------------------------------------------------
// Usernames
// ---------------------------------------------------------------------------

const usernameInputSchema = object({
  username: pipe(string(), maxLength(USERNAME_MAX_LENGTH * 2)),
});

export const checkUsername = createServerFn({ method: "GET" })
  .validator((data: { username: string }) => parse(usernameInputSchema, data))
  .handler(async ({ data }): Promise<UsernameCheck> => {
    const session = await requireSession();
    return checkUsernameFor(data.username, session.user.id);
  });

/** Current username, or a free suggestion for accounts that have none. */
export const suggestUsername = createServerFn({ method: "GET" }).handler(
  async (): Promise<string> => {
    const session = await requireSession();
    if (session.user.username) {
      return session.user.username;
    }
    return findAvailableUsername([
      session.user.email.split("@")[0],
      session.user.name,
    ]);
  }
);

export const confirmUsername = createServerFn({ method: "POST" })
  .validator((data: { username: string }) => parse(usernameInputSchema, data))
  .handler(async ({ data }): Promise<string> => {
    const session = await requireSession();
    return confirmUsernameFor(session.user.id, data.username);
  });

export const changeUsername = createServerFn({ method: "POST" })
  .validator((data: { username: string }) => parse(usernameInputSchema, data))
  .handler(async ({ data }): Promise<string> => {
    const session = await requireSession();
    return changeUsernameFor(session.user.id, data.username);
  });

// ---------------------------------------------------------------------------
// Sign-in methods
// ---------------------------------------------------------------------------

const setPasswordSchema = object({
  newPassword: pipe(
    string(),
    minLength(MIN_PASSWORD_LENGTH, "Password must be at least 8 characters."),
    maxLength(MAX_PASSWORD_LENGTH)
  ),
});

/**
 * Adds a password to an account that only signs in with Google, GitHub, or
 * a passkey. Better Auth only exposes this on the server.
 */
export const setPassword = createServerFn({ method: "POST" })
  .validator((data: { newPassword: string }) => parse(setPasswordSchema, data))
  .handler(async ({ data }): Promise<void> => {
    const session = await requireSession();
    if (await hasCredentialAccount(session.user.id)) {
      throw new AccountError("You already have a password. Change it instead.");
    }
    await auth.api.setPassword({
      body: { newPassword: data.newPassword },
      headers: getRequestHeaders(),
    });
  });
