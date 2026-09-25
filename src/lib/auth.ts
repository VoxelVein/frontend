import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { passkey } from "@better-auth/passkey";
import { betterAuth } from "better-auth";
import { admin, username } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";

import { db } from "@/db";

import env from "../../env.config";
import { ac, admin as adminRole, user as userRole } from "./permissions";

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
    },
  });
}

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

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },

  plugins: [
    username(),

    admin({
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

    // Sensitive actions (e.g. deleting the account) require a session
    // created within the last day.
    freshAge: ONE_DAY_IN_SECONDS,

    // Extend the session expiry at most once per day instead of on every
    // request.
    updateAge: ONE_DAY_IN_SECONDS,
  },

  socialProviders,

  trustedOrigins,

  user: {
    deleteUser: {
      enabled: true,
    },
  },
});
