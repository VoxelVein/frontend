import { relations, sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import type { UserNotificationType } from "../lib/notifications";
import type {
  ProjectImageKind,
  ProjectStatus,
  ProjectType,
  ReleaseChannel,
} from "../lib/projects";

export const users = pgTable("users", {
  banExpires: timestamp("ban_expires"),
  banReason: text("ban_reason"),
  banned: boolean("banned").default(false).notNull(),
  // Markdown shown on the public profile. Nullable rather than empty-string
  // default so "no bio" stays distinguishable from a bio that renders to
  // nothing. Length is capped in src/lib/bio.ts, not here.
  bio: text("bio"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  // Set when the owner asked to delete an account that owns or owned a
  // project. The account is banned meanwhile and purged 14 days later unless
  // an admin restores it.
  deletionRequestedAt: timestamp("deletion_requested_at"),
  displayUsername: text("display_username"),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  // Whether the user ever created a project. Projects can be hard-deleted, so
  // this is the only record that decides immediate vs. delayed deletion.
  hasOwnedProject: boolean("has_owned_project").default(false).notNull(),
  id: text("id").primaryKey(),
  image: text("image"),
  name: text("name").notNull(),
  role: text("role").default("user").notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  username: text("username").unique(),
  // Last self-service username change; starts the change cooldown.
  usernameChangedAt: timestamp("username_changed_at"),
  // False for accounts created through Google/GitHub until the user confirms
  // the generated username on /welcome.
  usernameConfirmed: boolean("username_confirmed").default(true).notNull(),
});

/**
 * Usernames a user gave up recently. The old name stays reserved for them
 * (and still signs them in) until `expiresAt`, then becomes free again.
 */
export const usernameHistory = pgTable(
  "username_history",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    username: text("username").notNull(),
  },
  (table) => [
    index("username_history_username_idx").on(table.username),
    index("username_history_userId_idx").on(table.userId),
  ]
);

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
  (table) => [index("accounts_userId_idx").on(table.userId)]
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
    /**
     * @deprecated Superseded by the `postAuthors` table; nothing reads it.
     *
     * Kept only because a migration drops columns automatically at merge time
     * while the previous version is still serving, and the previous version
     * still inserts into this column. Dropping it in the same deploy would fail
     * those inserts. Once this version is live everywhere, the follow-up is a
     * single migration: drop `author_id` and `posts_authorId_idx`, then delete
     * this field.
     *
     * Nullable rather than NOT NULL so this version can insert without naming
     * it — the original constraint would have rejected every new post.
     */
    authorId: text("author_id"),
    // One of `POST_CATEGORIES` in src/lib/posts.ts, or null for "none". Stored as
    // text rather than a Postgres enum so a category can be added without a
    // migration, matching how `projects.category` works. Null rather than the
    // string "none" so "uncategorised" stays distinguishable from a category
    // whose label happens to be a real word.
    category: text("category"),
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
    // listPosts filters on `published` and orders by `createdAt` descending.
    // A single-column index on `published` cannot supply the sort, so Postgres
    // sorts every matching row. This composite index serves both.
    index("posts_published_createdAt_idx").on(table.published, table.createdAt),
    // Groups the blog index by category.
    index("posts_category_idx").on(table.category),
  ]
);

/**
 * Who a post is written by, in display order.
 *
 * A post can credit several people — an engineering write-up usually has more
 * than one author — so authorship cannot live on `posts` itself. This is the
 * only record of a post's authors: an earlier `posts.authorId` column was
 * backfilled into here and dropped, because two places naming the author can
 * disagree about who the author is.
 *
 * `position` is explicit rather than relying on insertion order, because a
 * re-save that rewrites the rows must not reshuffle the byline. 0 is the
 * primary author and is what the post card falls back to for its avatar.
 */
export const postAuthors = pgTable(
  "post_authors",
  {
    postId: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    position: integer("position").default(0).notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.postId, table.userId] }),
    // Reads a user's posts, and the profile lists them.
    index("post_authors_userId_idx").on(table.userId),
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
    // Admin-marked protected project: never deleted along with its owner's
    // account, it is kept without an owner instead.
    isProtected: boolean("is_protected").default(false).notNull(),
    /**
     * When staff last took this project down, if they ever did.
     *
     * The column exists because `status` alone cannot answer the question. A takedown
     * sets the status to `removed`, and by the time the project is live again that
     * fact has been overwritten by whatever came next — so without this there is no
     * way to tell a project staff pulled from one the author simply unpublished, and
     * the two need opposite treatment on the way back up.
     *
     * Cleared when staff approve a review, because an approval is a fresh, explicit
     * decision that this project is fine. Left in place after an author unpublishes,
     * which is the whole point: an owner withdrawing their own work says nothing
     * about whether the content is acceptable.
     */
    takenDownAt: timestamp("taken_down_at"),
    // Null once the owner's account is deleted and the project was kept.
    ownerId: text("owner_id").references(() => users.id, {
      onDelete: "set null",
    }),
    // Chosen for deletion with the owner's account. Hidden right away and
    // removed when the account is purged.
    pendingDeletion: boolean("pending_deletion").default(false).notNull(),
    publishedAt: timestamp("published_at"),
    // Why an admin sent the project back to draft. Cleared when the creator
    // resubmits, so it only ever describes the most recent rejection.
    rejectionReason: text("rejection_reason"),
    // When an admin last decided on this project, and who. Null while the
    // project has never been reviewed. Set null if the reviewing admin's
    // account is deleted, which is why it is a soft reference rather than a
    // required one.
    reviewedAt: timestamp("reviewed_at"),
    reviewedBy: text("reviewed_by").references(() => users.id, {
      onDelete: "set null",
    }),
    slug: text("slug").notNull().unique(),
    status: text("status").$type<ProjectStatus>().default("draft").notNull(),
    // When the creator asked for review. Null unless status is "pending", and
    // the review queue orders by it so the oldest request is served first.
    submittedAt: timestamp("submitted_at"),
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
    // The review queue filters on `status = 'pending'` and orders by
    // `submitted_at` ascending, oldest request first. The status index alone
    // cannot supply that sort, so it would read and sort every pending row.
    index("projects_status_submittedAt_idx").on(
      table.status,
      table.submittedAt
    ),
    index("projects_type_idx").on(table.type),
    // listMyProjects filters on `owner_id` and orders by `updated_at`
    // descending. The ownerId index alone cannot supply that sort.
    index("projects_ownerId_updatedAt_idx").on(table.ownerId, table.updatedAt),
  ]
);

/**
 * Join details for `server` projects, which list a server instead of
 * shipping files. One row per server project.
 */
export const projectServers = pgTable("project_servers", {
  // Hostname or IP address, without a port.
  address: text("address").notNull(),
  gameVersions: text("game_versions").array().default([]).notNull(),
  // Null means the Minecraft default, 25565.
  port: integer("port"),
  projectId: uuid("project_id")
    .primaryKey()
    .references(() => projects.id, { onDelete: "cascade" }),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

/**
 * Mods, modpacks, shaders, and resource packs a server links to, each either
 * required to join or only recommended.
 */
export const projectServerLinks = pgTable(
  "project_server_links",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    linkedProjectId: uuid("linked_project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    required: boolean("required").default(false).notNull(),
    serverId: uuid("server_id")
      .notNull()
      .references(() => projectServers.projectId, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.serverId, table.linkedProjectId] }),
    // Finds the servers to reindex when a linked project changes.
    index("project_server_links_linkedProjectId_idx").on(table.linkedProjectId),
  ]
);

/** Inbox entries shown to every admin in the admin panel. */
export const adminNotifications = pgTable(
  "admin_notifications",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    id: uuid("id").primaryKey().defaultRandom(),
    message: text("message").notNull(),
    projectId: uuid("project_id").references(() => projects.id, {
      onDelete: "set null",
    }),
    readAt: timestamp("read_at"),
    title: text("title").notNull(),
    type: text("type").notNull(),
    userId: text("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
  },
  (table) => [index("admin_notifications_readAt_idx").on(table.readAt)]
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
    // Also serves lookups by version, as version_id leads the index.
    uniqueIndex("project_files_versionId_filename_uidx").on(
      table.versionId,
      table.filename
    ),
    // At most one primary file per version.
    uniqueIndex("project_files_versionId_primary_uidx")
      .on(table.versionId)
      .where(sql`${table.primary}`),
    index("project_files_sha1_idx").on(table.sha1),
  ]
);

/**
 * A project's icon and gallery images, stored in object storage.
 *
 * One table for both kinds rather than an icon column plus a gallery table,
 * so quota accounting and deletion are uniform. A project has at most one
 * icon, enforced by the partial unique index below.
 *
 * Distinct from `project_files`, which holds the downloadable archives a
 * version ships. Images are never served as downloads and never counted as
 * project downloads.
 */
/**
 * A user's uploaded avatar.
 *
 * A table rather than a column on `users` for the same reason project images
 * get one: the stored object has to be deleted when it is replaced, and that
 * needs the key captured *before* the row is overwritten. A single column
 * cannot hold both the old and the new key.
 *
 * One row per account. The partial unique index enforces that in the database,
 * so two concurrent uploads cannot leave two live avatars.
 *
 * Avatars count against the same site-wide quota as project files — see
 * `insertFileWithinQuota` — so a few thousand accounts cannot quietly displace
 * the mods that are the point of the site.
 */
export const userImages = pgTable(
  "user_images",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    // Sniffed from the uploaded bytes, never from the request.
    contentType: text("content_type").notNull(),
    height: integer("height").notNull(),
    id: uuid("id").primaryKey().defaultRandom(),
    // `text`, not `uuid`, because `users.id` is text: Better Auth's key type,
    // and a foreign key cannot reference across types. The avatar id is a
    // uuid because it is ours, not Better Auth's.
    //
    // Cascades, so purging an account takes its avatar row with it.
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    size: bigint("size", { mode: "number" }).notNull(),
    storageKey: text("storage_key").notNull().unique(),
    width: integer("width").notNull(),
  },
  (table) => [
    // At most one avatar per account.
    uniqueIndex("user_images_userId_uidx").on(table.userId),
  ]
);

/**
 * Something a member reported, for a moderator to triage.
 *
 * One table for both target kinds rather than two, so the inbox, the ordering,
 * and the resolution flow are written once. `targetKind` says which of the two
 * nullable id columns is the subject, and a CHECK constraint enforces that
 * exactly one is set — an application-level "only set one" rule would be a
 * request the next write path forgets.
 *
 * The reporter is `set null` on delete rather than cascading: a report is
 * evidence about the target and stays useful after the person who filed it
 * leaves. Their identity goes with the account, which is what account deletion
 * promises, so the row survives as an unattributed report.
 *
 * A report about a project cascades instead, because there is nothing left to
 * moderate once the project is gone.
 */
export const reports = pgTable(
  "reports",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    // Free text the reporter adds. Optional, because the reason alone is often
    // enough and requiring prose would push people towards leaving nothing.
    details: text("details"),
    id: uuid("id").primaryKey().defaultRandom(),
    // Cascades: a report about a deleted project has nothing left to act on.
    projectId: uuid("project_id").references(() => projects.id, {
      onDelete: "cascade",
    }),
    reason: text("reason").notNull(),
    // Null once the reporter's account is deleted; see the note above.
    reporterId: text("reporter_id").references(() => users.id, {
      onDelete: "set null",
    }),
    // Null once the account is deleted, but the report itself stays.
    reportedUserId: text("reported_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    /** Null while the report is awaiting a decision. */
    resolvedAt: timestamp("resolved_at"),
    /** Null while awaiting a decision, or when dismissed without review. */
    resolvedById: text("resolved_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    status: text("status").default("open").notNull(),
    targetKind: text("target_kind").notNull(),
  },
  (table) => [
    // The inbox: open reports, newest first.
    index("reports_status_createdAt_idx").on(table.status, table.createdAt),
    // "Has this account already reported this?" and the abuse trail per reporter.
    index("reports_reporterId_idx").on(table.reporterId),
    check(
      "reports_one_target_check",
      sql`(
        (${table.targetKind} = 'project' AND ${table.projectId} IS NOT NULL AND ${table.reportedUserId} IS NULL)
        OR
        (${table.targetKind} = 'user' AND ${table.reportedUserId} IS NOT NULL AND ${table.projectId} IS NULL)
      )`
    ),
  ]
);

export const projectImages = pgTable(
  "project_images",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    // Sniffed from the uploaded bytes, never taken from the request.
    contentType: text("content_type").notNull(),
    height: integer("height").notNull(),
    id: uuid("id").primaryKey().defaultRandom(),
    kind: text("kind").$type<ProjectImageKind>().notNull(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    size: bigint("size", { mode: "number" }).notNull(),
    storageKey: text("storage_key").notNull().unique(),
    width: integer("width").notNull(),
  },
  (table) => [
    // At most one icon per project. Gallery images are unconstrained.
    uniqueIndex("project_images_projectId_icon_uidx")
      .on(table.projectId)
      .where(sql`${table.kind} = 'icon'`),
    // Listing a project's images, which a leading project_id serves directly.
    index("project_images_projectId_createdAt_idx").on(
      table.projectId,
      table.createdAt
    ),
  ]
);

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  passkeys: many(passkeys),
  postAuthors: many(postAuthors),
  projects: many(projects),
  sessions: many(sessions),
  usernameHistory: many(usernameHistory),
}));

export const usernameHistoryRelations = relations(
  usernameHistory,
  ({ one }) => ({
    user: one(users, {
      fields: [usernameHistory.userId],
      references: [users.id],
    }),
  })
);

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

export const postsRelations = relations(posts, ({ many }) => ({
  authors: many(postAuthors),
}));

export const postAuthorsRelations = relations(postAuthors, ({ one }) => ({
  post: one(posts, {
    fields: [postAuthors.postId],
    references: [posts.id],
  }),
  user: one(users, {
    fields: [postAuthors.userId],
    references: [users.id],
  }),
}));

export const projectsRelations = relations(projects, ({ many, one }) => ({
  images: many(projectImages),
  owner: one(users, {
    fields: [projects.ownerId],
    references: [users.id],
  }),
  versions: many(projectVersions),
}));

export const userImagesRelations = relations(userImages, ({ one }) => ({
  user: one(users, {
    fields: [userImages.userId],
    references: [users.id],
  }),
}));

export const projectImagesRelations = relations(projectImages, ({ one }) => ({
  project: one(projects, {
    fields: [projectImages.projectId],
    references: [projects.id],
  }),
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

/**
 * Notifications addressed to one user, shown in the navbar.
 *
 * Distinct from `admin_notifications`, which is a shared inbox every admin
 * reads. A row here belongs to a single account and is deleted with it, and
 * with the project it refers to, because a notification pointing at a
 * deleted project has nothing left to say.
 *
 * `project_id` is nullable because not every notification is about the
 * reader's own project: the outcome of a report they filed is about the
 * report, and has no project to link to. Those rows carry no destination and
 * are read in place. It was NOT NULL before report outcomes existed, which
 * meant the only way to notify a reporter was to attach the notification to
 * some arbitrary project — a link to somewhere unrelated.
 */
export const userNotifications = pgTable(
  "user_notifications",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    id: uuid("id").primaryKey().defaultRandom(),
    message: text("message").notNull(),
    projectId: uuid("project_id").references(() => projects.id, {
      onDelete: "cascade",
    }),
    readAt: timestamp("read_at"),
    title: text("title").notNull(),
    type: text("type").$type<UserNotificationType>().notNull(),
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
  },
  (table) => [
    // The unread badge is read on every page load, so it gets its own index
    // rather than reusing the listing one.
    index("user_notifications_userId_readAt_idx").on(
      table.userId,
      table.readAt
    ),
    // The dropdown lists newest first, which this index supplies directly.
    index("user_notifications_userId_createdAt_idx").on(
      table.userId,
      table.createdAt
    ),
  ]
);

export const projectFilesRelations = relations(projectFiles, ({ one }) => ({
  version: one(projectVersions, {
    fields: [projectFiles.versionId],
    references: [projectVersions.id],
  }),
}));

export const userNotificationsRelations = relations(
  userNotifications,
  ({ one }) => ({
    project: one(projects, {
      fields: [userNotifications.projectId],
      references: [projects.id],
    }),
    user: one(users, {
      fields: [userNotifications.userId],
      references: [users.id],
    }),
  })
);
