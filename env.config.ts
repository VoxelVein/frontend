import { config } from "dotenv";
import { defineEnv } from "envin";
import {
  minLength,
  optional,
  picklist,
  pipe,
  regex,
  string,
  url,
} from "valibot";

config({ path: ".env.local" });

// Apply defaults before validation so Valibot schemas only validate presence + format.
const envWithDefaults = {
  ...process.env,
  API_URL: process.env.API_URL ?? "http://localhost:3002",
  BETTER_AUTH_TRUSTED_ORIGINS: process.env.BETTER_AUTH_TRUSTED_ORIGINS,
  GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  MEILI_HOST: process.env.MEILI_HOST ?? "http://localhost:7700",
  MEILI_MASTER_KEY: process.env.MEILI_MASTER_KEY,
  MEILI_SEARCH_KEY: process.env.MEILI_SEARCH_KEY,
  NODE_ENV: process.env.NODE_ENV ?? "development",
  // Blank optional values from .env files mean "unset", not an empty URL.
  STORAGE_MAX_FILE_BYTES: process.env.STORAGE_MAX_FILE_BYTES || undefined,
  STORAGE_PUBLIC_URL: process.env.STORAGE_PUBLIC_URL || undefined,
  STORAGE_QUOTA_BYTES: process.env.STORAGE_QUOTA_BYTES || undefined,
  TURNSTILE_HOSTNAMES: process.env.TURNSTILE_HOSTNAMES,
  TURNSTILE_SECRET: process.env.TURNSTILE_SECRET,
  VITE_GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
  VITE_GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  // Absolute origin of the deployment. Used for Open Graph URLs, JSON-LD, and
  // the sitemap, all of which need an absolute URL rather than a path. Defaults
  // to the dev server so local runs produce valid markup.
  VITE_SITE_URL: process.env.VITE_SITE_URL ?? "http://localhost:3000",
};

const env = defineEnv({
  env: envWithDefaults,
  server: {
    API_URL: pipe(string(), url()),
    BETTER_AUTH_SECRET: pipe(string(), minLength(32)),
    BETTER_AUTH_TRUSTED_ORIGINS: optional(string()),
    BETTER_AUTH_URL: pipe(string(), url()),
    DATABASE_URL: pipe(string(), url()),
    GITHUB_CLIENT_ID: optional(string()),
    GITHUB_CLIENT_SECRET: optional(string()),
    GOOGLE_CLIENT_ID: optional(string()),
    GOOGLE_CLIENT_SECRET: optional(string()),
    MEILI_ADMIN_KEY: optional(string()),
    MEILI_HOST: pipe(string(), url()),
    MEILI_MASTER_KEY: optional(string()),
    MEILI_SEARCH_KEY: optional(string()),
    STORAGE_ACCESS_KEY_ID: optional(string()),
    STORAGE_BUCKET: optional(string()),
    STORAGE_ENDPOINT: optional(pipe(string(), url())),
    STORAGE_FORCE_PATH_STYLE: optional(picklist(["true", "false"])),
    STORAGE_MAX_FILE_BYTES: optional(pipe(string(), regex(/^\d+$/u))),
    STORAGE_PUBLIC_URL: optional(pipe(string(), url())),
    STORAGE_QUOTA_BYTES: optional(pipe(string(), regex(/^\d+$/u))),
    STORAGE_REGION: optional(string()),
    STORAGE_SECRET_ACCESS_KEY: optional(string()),
    TURNSTILE_HOSTNAMES: optional(string()),
    TURNSTILE_SECRET: optional(string()),
  },
  shared: {
    NODE_ENV: picklist(["development", "production", "test"]),
    VITE_GITHUB_CLIENT_ID: optional(string()),
    VITE_GOOGLE_CLIENT_ID: optional(string()),
    VITE_SITE_URL: pipe(string(), url()),
    VITE_TURNSTILE_SITE_KEY: optional(string()),
  },
});

export default env;
