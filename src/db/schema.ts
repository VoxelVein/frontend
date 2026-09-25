import { relations } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import type {
  ProjectStatus,
  ProjectType,
  ReleaseChannel,
} from "../lib/projects";

export const users = pgTable("users", {
  banExpires: timestamp("ban_expires"),
  banReason: text("ban_reason"),
  banned: boolean("banned").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  displayUsername: text("display_username"),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  id: text("id").primaryKey(),
  image: text("image"),
  name: text("name").notNull(),
  role: text("role").default("user").notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  username: text("username").unique(),
});

export const sessions = pgTable(
  "sessions",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    id: text("id").primaryKey(),
    impersonatedBy: text("impersonated_by"),
    ipAddress: text("ip_address"),
    token: text("token").notNull().unique(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (table) => [index("sessions_userId_idx").on(table.userId)]
);

export const accounts = pgTable(
  "accounts",
  {
    accessToken: text("access_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    accountId: text("account_id").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    id: text("id").primaryKey(),
    idToken: text("id_token"),
    issuer: text("issuer").notNull(),
    password: text("password"),
    providerId: text("provider_id").notNull(),
    refreshToken: text("refresh_token"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("accounts_issuer_accountId_uidx").on(
      table.issuer,
      table.accountId
    ),
    index("accounts_userId_idx").on(table.userId),
  ]
);

export const verifications = pgTable(
  "verifications",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    value: text("value").notNull(),
  },
  (table) => [index("verifications_identifier_idx").on(table.identifier)]
);

export const passkeys = pgTable(
  "passkeys",
  {
    aaguid: text("aaguid"),
    backedUp: boolean("backed_up").notNull(),
    counter: integer("counter").notNull(),
    createdAt: timestamp("created_at"),
    credentialID: text("credential_id").notNull(),
    deviceType: text("device_type").notNull(),
    id: text("id").primaryKey(),
    name: text("name"),
    publicKey: text("public_key").notNull(),
    transports: text("transports"),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("passkeys_userId_idx").on(table.userId),
    index("passkeys_credentialID_idx").on(table.credentialID),
  ]
);

export const posts = pgTable(
  "posts",
  {
    authorId: text("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    excerpt: text("excerpt"),
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    published: boolean("published").default(false).notNull(),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("posts_authorId_idx").on(table.authorId),
    index("posts_published_idx").on(table.published),
  ]
);

export const projects = pgTable(
  "projects",
  {
    category: text("category").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    description: text("description").default("").notNull(),
    downloads: integer("downloads").default(0).notNull(),
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    publishedAt: timestamp("published_at"),
    slug: text("slug").notNull().unique(),
    status: text("status").$type<ProjectStatus>().default("draft").notNull(),
    summary: text("summary").notNull(),
    tags: text("tags").array().default([]).notNull(),
    type: text("type").$type<ProjectType>().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("projects_ownerId_idx").on(table.ownerId),
    index("projects_status_idx").on(table.status),
    index("projects_type_idx").on(table.type),
  ]
);

export const projectVersions = pgTable(
  "project_versions",
  {
    changelog: text("changelog").default("").notNull(),
    channel: text("channel")
      .$type<ReleaseChannel>()
      .default("release")
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    downloads: integer("downloads").default(0).notNull(),
    gameVersions: text("game_versions").array().notNull(),
    id: uuid("id").primaryKey().defaultRandom(),
    loaders: text("loaders").array().notNull(),
    name: text("name").notNull(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    versionNumber: text("version_number").notNull(),
  },
  (table) => [
    uniqueIndex("project_versions_projectId_versionNumber_uidx").on(
      table.projectId,
      table.versionNumber
    ),
  ]
);

export const projectFiles = pgTable(
  "project_files",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    filename: text("filename").notNull(),
    id: uuid("id").primaryKey().defaultRandom(),
    primary: boolean("primary").default(false).notNull(),
    sha1: text("sha1").notNull(),
    sha512: text("sha512").notNull(),
    size: bigint("size", { mode: "number" }).notNull(),
    storageKey: text("storage_key").notNull().unique(),
    versionId: uuid("version_id")
      .notNull()
      .references(() => projectVersions.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("project_files_versionId_idx").on(table.versionId),
    index("project_files_sha1_idx").on(table.sha1),
  ]
);

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  passkeys: many(passkeys),
  posts: many(posts),
  projects: many(projects),
  sessions: many(sessions),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
}));

export const passkeysRelations = relations(passkeys, ({ one }) => ({
  user: one(users, {
    fields: [passkeys.userId],
    references: [users.id],
  }),
}));

export const postsRelations = relations(posts, ({ one }) => ({
  author: one(users, {
    fields: [posts.authorId],
    references: [users.id],
  }),
}));

export const projectsRelations = relations(projects, ({ many, one }) => ({
  owner: one(users, {
    fields: [projects.ownerId],
    references: [users.id],
  }),
  versions: many(projectVersions),
}));

export const projectVersionsRelations = relations(
  projectVersions,
  ({ many, one }) => ({
    files: many(projectFiles),
    project: one(projects, {
      fields: [projectVersions.projectId],
      references: [projects.id],
    }),
  })
);

export const projectFilesRelations = relations(projectFiles, ({ one }) => ({
  version: one(projectVersions, {
    fields: [projectFiles.versionId],
    references: [projectVersions.id],
  }),
}));
