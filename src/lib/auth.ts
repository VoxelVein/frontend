import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { passkey } from "@better-auth/passkey";
import { betterAuth } from "better-auth";
import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthMiddleware, getIP } from "better-auth/api";
import { admin, username } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { looseObject, optional, parse, string, unknown } from "valibot";

import { db } from "@/db";
import {
  findAvailableUsername,
  isUsernameFree,
  resolveReservedUsername,
} from "@/lib/account-lifecycle";
import { isReservedUsername } from "@/lib/usernames";

import env from "../../env.config";
import { ac, admin as adminRole, user as userRole } from "./permissions";
import {
  getTurnstileConfigProblems,
  parseHostnames,
  TURNSTILE_FAILURE,
  TURNSTILE_TOKEN_HEADER,
  verifyTurnstileToken,
} from "./turnstile";
import type { TurnstileAction } from "./turnstile";

const rpID = new URL(env.BETTER_AUTH_URL).hostname;

const ONE_DAY_IN_SECONDS = 60 * 60 * 24;
const SESSION_EXPIRES_IN_SECONDS = ONE_DAY_IN_SECONDS * 30;

const socialProviders = {};

if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
  Object.assign(socialProviders, {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    },
  });
}

if (env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET) {
  Object.assign(socialProviders, {
    github: {
      clientId: env.GITHUB_CLIENT_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET,
      // Seeds the generated username (see `databaseHooks` below).
      mapProfileToUser: (profile: { login?: string }) => ({
        username: profile.login,
      }),
    },
  });
}

const SIGN_UP_EMAIL_PATH = "/sign-up/email";

// Password-based entry points get a Turnstile check. Passkeys and social
// sign-in are already resistant to automated abuse and are not gated.
const TURNSTILE_ACTIONS = new Map<string, TurnstileAction>([
  ["/sign-in/email", "login"],
  ["/sign-in/username", "login"],
  [SIGN_UP_EMAIL_PATH, "signup"],
]);

const turnstileConfig = {
  hostnames: parseHostnames(env.TURNSTILE_HOSTNAMES),
  isProduction: env.NODE_ENV === "production",
  secret: env.TURNSTILE_SECRET ?? null,
};

const turnstileConfigProblems = getTurnstileConfigProblems(turnstileConfig);
if (turnstileConfigProblems.length > 0) {
  console.error(
    `Turnstile is misconfigured, so password sign-in and sign-up will be rejected: ${turnstileConfigProblems.join(" ")}`
  );
}

const requireTurnstile = createAuthMiddleware(async (ctx) => {
  const expectedAction = TURNSTILE_ACTIONS.get(ctx.path);
  if (!expectedAction) {
    return;
  }

  const result = await verifyTurnstileToken(
    {
      expectedAction,
      remoteIp: ctx.request ? getIP(ctx.request, ctx.context.options) : null,
      token: ctx.headers?.get(TURNSTILE_TOKEN_HEADER),
    },
    turnstileConfig
  );

  if (result.ok) {
    return;
  }
  if (
    result.reason === TURNSTILE_FAILURE.notConfigured ||
    result.reason === TURNSTILE_FAILURE.siteverifyUnavailable
  ) {
    throw new APIError("SERVICE_UNAVAILABLE", {
      message: "We couldn't verify that you're human right now. Try again.",
    });
  }
  throw new APIError("FORBIDDEN", {
    message: "Human verification failed. Complete the check and try again.",
  });
});

const USERNAME_PATTERN = /^[a-zA-Z0-9_.]+$/u;

// Sign-up paths where the user typed their own username. Every other way an
// account is created (Google, GitHub) gets a generated one to confirm.
const USERNAME_CHOSEN_PATHS = new Set([
  SIGN_UP_EMAIL_PATH,
  "/admin/create-user",
]);

// Request bodies are parsed here, at the hook boundary. Loose objects keep
// every other field for Better Auth's own validation.
const usernameBodySchema = looseObject({ username: optional(string()) });
const profileUpdateSchema = looseObject({
  displayUsername: optional(unknown()),
  username: optional(unknown()),
});

const UPDATE_USER_PATH = "/update-user";

/**
 * Username rules the username plugin does not know about: names another user
 * gave up recently stay reserved for them, and still sign them in. Username
 * changes go through the cooldown in account-lifecycle.ts, never through the
 * generic update endpoint.
 */
const accountRules = {
  hooks: {
    before: [
      {
        matcher: (context) =>
          context.path === SIGN_UP_EMAIL_PATH ||
          context.path === UPDATE_USER_PATH,
        handler: createAuthMiddleware(async (ctx) => {
          if (ctx.path === UPDATE_USER_PATH) {
            const update = parse(profileUpdateSchema, ctx.body);
            if (
              update.username !== undefined ||
              update.displayUsername !== undefined
            ) {
              throw new APIError("BAD_REQUEST", {
                message: "Change your username in Settings → Profile.",
              });
            }
            return;
          }
          const { username: requested } = parse(usernameBodySchema, ctx.body);
          if (requested && !(await isUsernameFree(requested))) {
            throw new APIError("BAD_REQUEST", {
              message: "This username is already taken.",
            });
          }
        }),
      },
      {
        matcher: (context) => context.path === "/sign-in/username",
        handler: createAuthMiddleware(async (ctx) => {
          const { username: requested } = parse(usernameBodySchema, ctx.body);
          const current = requested
            ? await resolveReservedUsername(requested)
            : null;
          if (current) {
            return { context: { body: { ...ctx.body, username: current } } };
          }
        }),
      },
      {
        matcher: (context) => context.path === "/is-username-available",
        handler: createAuthMiddleware(async (ctx) => {
          const { username: requested } = parse(usernameBodySchema, ctx.body);
          if (requested && !(await isUsernameFree(requested))) {
            return ctx.json({ available: false });
          }
        }),
      },
    ],
  },
  id: "account-rules",
} satisfies BetterAuthPlugin;

const trustedOrigins = [
  env.BETTER_AUTH_URL,
  "http://localhost:3000",
  ...(env.BETTER_AUTH_TRUSTED_ORIGINS?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean) ?? []),
];

export const auth = betterAuth({
  account: {
    accountLinking: {
      // Signed-in users may link a GitHub or Google account whose email
      // differs from theirs. Linking needs an active session, so it cannot be
      // used to take over someone else's account.
      allowDifferentEmails: true,
      // Only auto-link a social login to an existing account whose email has
      // been verified locally. Email verification is off, so this blocks
      // pre-registration takeover (attacker signs up with a victim's email
      // and a password, victim later signs in with Google/GitHub).
      requireLocalEmailVerified: true,
    },
  },

  appName: "VoxelVein",

  baseURL: env.BETTER_AUTH_URL,

  database: drizzleAdapter(db, {
    provider: "pg",
    usePlural: true,
  }),

  databaseHooks: {
    user: {
      create: {
        before: async (user, ctx) => {
          if (ctx?.path && USERNAME_CHOSEN_PATHS.has(ctx.path)) {
            return;
          }
          // GitHub's login arrives here through mapProfileToUser.
          const { username: hint } = parse(usernameBodySchema, user);
          const generated = await findAvailableUsername([
            hint,
            user.email.split("@")[0],
            user.name,
          ]);
          return {
            data: {
              ...user,
              displayUsername: generated,
              username: generated,
              usernameConfirmed: false,
            },
          };
        },
      },
    },
  },

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },

  hooks: {
    before: requireTurnstile,
  },

  plugins: [
    username({
      usernameValidator: (value) =>
        USERNAME_PATTERN.test(value) && !isReservedUsername(value),
    }),

    accountRules,

    admin({
      // Also shown to accounts waiting out their deletion grace period.
      bannedUserMessage:
        "This account is suspended or scheduled for deletion. Contact support if you think this is a mistake.",
      ac,
      roles: {
        admin: adminRole,
        user: userRole,
      },
    }),

    passkey({
      origin: env.BETTER_AUTH_URL,
      rpID,
      rpName: "VoxelVein",
    }),

    tanstackStartCookies(),
  ],

  secret: env.BETTER_AUTH_SECRET,

  session: {
    expiresIn: SESSION_EXPIRES_IN_SECONDS,

    // Sensitive Better Auth actions require a session created within the
    // last day. Account deletion is stricter (see account.functions.ts).
    freshAge: ONE_DAY_IN_SECONDS,

    // Extend the session expiry at most once per day instead of on every
    // request.
    updateAge: ONE_DAY_IN_SECONDS,
  },

  socialProviders,

  trustedOrigins,

  user: {
    additionalFields: {
      deletionRequestedAt: { input: false, required: false, type: "date" },
      hasOwnedProject: {
        defaultValue: false,
        input: false,
        required: false,
        type: "boolean",
      },
      usernameChangedAt: { input: false, required: false, type: "date" },
      usernameConfirmed: {
        defaultValue: true,
        input: false,
        required: false,
        type: "boolean",
      },
    },
    // Deletion goes through account.functions.ts, which re-verifies the user
    // and handles projects, so Better Auth's own endpoint stays off.
    deleteUser: {
      enabled: false,
    },
  },
});
