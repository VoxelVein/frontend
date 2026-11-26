import { relations, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import type { UserNotificationType } from "../lib/notifications";
import type { ProjectTransferStatus } from "../lib/project-transfers";
import type {
  ProjectDisclosure,
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
 * A post can credit several people  -  an engineering write-up usually has more
 * than one author  -  so authorship cannot live on `posts` itself. This is the
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
    /**
     * Creator disclosures, each a type plus the explanation a reader needs.
     *
     * Project-level rather than per version: an AI-assisted icon or a
     * discontinued release describes the listing as a whole. Stored as JSON
     * because a project has at most seven entries and nothing queries into
     * them; the app validates the types, so extending the list needs no
     * migration.
     */
    disclosures: jsonb("disclosures")
      .$type<ProjectDisclosure[]>()
      .default([])
      .notNull(),
    downloads: integer("downloads").default(0).notNull(),
    totalVotes: integer("total_votes").default(0).notNull(),
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
     * fact has been overwritten by whatever came next  -  so without this there is no
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
    // `reviewed_by` is set null when the reviewing admin's account is deleted.
    // Without this, deleting an account that has ever reviewed anything
    // sequential-scans `projects`. See the foreign-key index rule in
    // docs/database/migrations.md.
    index("projects_reviewedBy_idx").on(table.reviewedBy),
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
/**
 * Append-only history. Transactions serialize on the project before checking cooldowns.
 */
export const serverVotes = pgTable(
  "server_votes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    minecraftUsername: text("minecraft_username").notNull(),
    address: text("address"),
    edition: text("edition").notNull().$type<"java" | "bedrock">(),
    deliveryStatus: text("delivery_status").default("pending").notNull(),
    deliveryDetail: text("delivery_detail"),
    votedAt: timestamp("voted_at").defaultNow().notNull(),
  },
  (table) => [
    index("server_votes_project_id_idx").on(table.projectId, table.votedAt),
    index("server_votes_user_id_idx").on(table.userId),
  ]
);

/**
 * Per-server Votifier / NuVotifier configuration and voting toggle, owned by
 * the server's owner and managed from the dashboard.
 */
export const serverVoteConfig = pgTable(
  "server_vote_config",
  {
    projectId: uuid("project_id")
      .primaryKey()
      .references(() => projects.id, { onDelete: "cascade" }),
    votingEnabled: boolean("voting_enabled").default(false).notNull(),
    host: text("host"),
    port: integer("port"),
    // NuVotifier v2 uses HMAC tokens, classic Votifier v1 uses RSA public keys.
    protocol: text("protocol").default("v2").notNull().$type<"v1" | "v2">(),
    serviceName: text("service_name"),
    token: text("token"),
    publicKey: text("public_key"),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("server_vote_config_project_id_idx").on(table.projectId)]
);

/**
 * When an account last fetched a project's files.
 *
 * One row per account and project, overwritten on each download: the review
 * gate asks "have you fetched this recently enough?", not which version or how
 * many times. Only signed-in accounts are recorded, because only they can
 * leave a review; anonymous traffic stays in the aggregate download counter.
 */
export const projectDownloads = pgTable(
  "project_downloads",
  {
    downloadedAt: timestamp("downloaded_at").defaultNow().notNull(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (table) => [
    // Also lets one account's download of a project be replaced in place.
    uniqueIndex("project_downloads_userId_projectId_uidx").on(
      table.userId,
      table.projectId
    ),
    // Leading projectId serves the cascade check when a project is deleted.
    index("project_downloads_projectId_idx").on(table.projectId),
  ]
);

/**
 * A player's rating of a project or server, with an optional short note.
 *
 * The account is soft-deleted rather than cascaded: a review stays attached to
 * the listing after its author leaves, but loses the name that went with the
 * account. A project, in contrast, takes its reviews with it when removed.
 */
export const projectReviews = pgTable(
  "project_reviews",
  {
    comment: text("comment"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    // 1 through 5; validated by REVIEW_RATINGS at the request boundary.
    rating: integer("rating").notNull(),
    userId: text("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    // One review per account per listing, so an unfinished form cannot produce
    // two rows and a later visit cannot quietly add a second rating.
    uniqueIndex("project_reviews_userId_projectId_uidx").on(
      table.userId,
      table.projectId
    ),
    // Newest first, which is the order the public list renders.
    index("project_reviews_projectId_createdAt_idx").on(
      table.projectId,
      table.createdAt
    ),
  ]
);

/**
 * A comment on a blog post, or the project owner's reply to a review.
 *
 * One table with two target columns and a check constraint: both surfaces need
 * the same author, nesting and staff-heart behaviour, and a second table would
 * mean writing that three times. Blog comments may nest; review replies may
 * not, which the write path enforces.
 */
export const comments = pgTable(
  "comments",
  {
    // Soft-deleted: the comment stays useful after its author leaves.
    authorId: text("author_id").references(() => users.id, {
      onDelete: "set null",
    }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    id: uuid("id").primaryKey().defaultRandom(),
    // Nested replies on blog posts only. Deleting a parent takes its replies.
    parentId: uuid("parent_id").references((): AnyPgColumn => comments.id, {
      onDelete: "cascade",
    }),
    // Better Auth-style text id, matching `posts.id` exactly.
    postId: text("post_id").references(() => posts.id, {
      onDelete: "cascade",
    }),
    reviewId: uuid("review_id").references(() => projectReviews.id, {
      onDelete: "cascade",
    }),
    targetKind: text("target_kind").$type<"post" | "review">().notNull(),
  },
  (table) => [
    check(
      "comments_one_target_check",
      sql`(
        (${table.targetKind} = 'post' AND ${table.postId} IS NOT NULL AND ${table.reviewId} IS NULL)
        OR
        (${table.targetKind} = 'review' AND ${table.reviewId} IS NOT NULL AND ${table.postId} IS NULL)
      )`
    ),
    // The post page reads every comment for one post in created-at order.
    index("comments_postId_createdAt_idx").on(table.postId, table.createdAt),
    // Review responses are read with the reviews they answer.
    index("comments_reviewId_idx").on(table.reviewId),
    index("comments_parentId_idx").on(table.parentId),
    index("comments_authorId_idx").on(table.authorId),
  ]
);

/** A staff member's "heart" on a comment, at most one per account and comment. */
export const commentHearts = pgTable(
  "comment_hearts",
  {
    commentId: uuid("comment_id")
      .notNull()
      .references(() => comments.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.commentId, table.userId] }),
    // Seeded by the primary key on comment_id; this covers the other direction.
    index("comment_hearts_userId_idx").on(table.userId),
  ]
);

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
  (table) => [
    index("admin_notifications_readAt_idx").on(table.readAt),
    // Both foreign keys are `set null` on delete, so removing a user or a
    // project scans this table unless the column is indexed.
    index("admin_notifications_userId_idx").on(table.userId),
    index("admin_notifications_projectId_idx").on(table.projectId),
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
    platform: text("platform"),
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
    uniqueIndex("project_files_versionId_filename_uidx")
      .on(table.versionId, table.filename)
      .where(sql`${table.platform} is null`),
    // One downloadable distribution per platform and release.
    uniqueIndex("project_files_versionId_platform_uidx")
      .on(table.versionId, table.platform)
      .where(sql`${table.platform} is not null`),
    // At most one primary file per version.
    uniqueIndex("project_files_versionId_primary_uidx")
      .on(table.versionId)
      .where(sql`${table.primary}`),
    index("project_files_sha1_idx").on(table.sha1),
  ]
);

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
 * Avatars count against the same site-wide quota as project files  -  see
 * `insertFileWithinQuota`  -  so a few thousand accounts cannot quietly displace
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
 * exactly one is set  -  an application-level "only set one" rule would be a
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
    // `alreadyReported` filters on the subject, not the reporter, so it is the
    // other half of that question that needs an index. `project_id` also
    // cascades, which makes this the index a project delete relies on.
    index("reports_reportedUserId_idx").on(table.reportedUserId),
    index("reports_projectId_idx").on(table.projectId),
    // `set null` when a moderator's account is deleted: the resolution stands,
    // the name goes with the account.
    index("reports_resolvedById_idx").on(table.resolvedById),
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

export const supportTickets = pgTable(
  "support_tickets",
  {
    closedAt: timestamp("closed_at"),
    closedById: text("closed_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    id: uuid("id").primaryKey().defaultRandom(),
    status: text("status").default("open").notNull(),
    subject: text("subject").notNull(),
    tags: text("tags").array().default([]).notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("support_tickets_closedById_idx").on(table.closedById),
    index("support_tickets_userId_idx").on(table.userId),
    index("support_tickets_status_idx").on(table.status),
    index("support_tickets_createdAt_idx").on(table.createdAt),
  ]
);

export const supportTicketMessages = pgTable(
  "support_ticket_messages",
  {
    authorUserId: text("author_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    id: uuid("id").primaryKey().defaultRandom(),
    internal: boolean("internal").default(false).notNull(),
    ticketId: uuid("ticket_id")
      .notNull()
      .references(() => supportTickets.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("support_ticket_messages_authorUserId_idx").on(table.authorUserId),
    index("support_ticket_messages_ticketId_idx").on(table.ticketId),
    index("support_ticket_messages_createdAt_idx").on(table.createdAt),
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

export const serverVotesRelations = relations(serverVotes, ({ one }) => ({
  project: one(projects, {
    fields: [serverVotes.projectId],
    references: [projects.id],
  }),
  user: one(users, {
    fields: [serverVotes.userId],
    references: [users.id],
  }),
}));

export const serverVoteConfigRelations = relations(
  serverVoteConfig,
  ({ one }) => ({
    project: one(projects, {
      fields: [serverVoteConfig.projectId],
      references: [projects.id],
    }),
  })
);

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
 * some arbitrary project  -  a link to somewhere unrelated.
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
    // Cascades on project delete. Without this, removing a project
    // sequential-scans every notification ever sent about it.
    index("user_notifications_projectId_idx").on(table.projectId),
  ]
);

/**
 * An ownership hand-off. User-initiated transfers wait for the recipient to
 * accept; an admin transfer applies immediately, so it is recorded with the
 * accepted status and no offer to answer.
 */
export const projectTransfers = pgTable(
  "project_transfers",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    fromUserId: text("from_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .references(() => projects.id, { onDelete: "cascade" })
      .notNull(),
    resolvedAt: timestamp("resolved_at"),
    status: text("status")
      .$type<ProjectTransferStatus>()
      .default("pending")
      .notNull(),
    toUserId: text("to_user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
  },
  (table) => [
    // One open offer per project: a second request must not leave two people
    // able to accept the same hand-off.
    uniqueIndex("project_transfers_pending_project_idx")
      .on(table.projectId)
      .where(sql`${table.status} = 'pending'`),
    index("project_transfers_projectId_status_idx").on(
      table.projectId,
      table.status
    ),
    index("project_transfers_toUserId_status_idx").on(
      table.toUserId,
      table.status
    ),
    index("project_transfers_fromUserId_status_idx").on(
      table.fromUserId,
      table.status
    ),
  ]
);

export const projectTransfersRelations = relations(
  projectTransfers,
  ({ one }) => ({
    project: one(projects, {
      fields: [projectTransfers.projectId],
      references: [projects.id],
    }),
    fromUser: one(users, {
      fields: [projectTransfers.fromUserId],
      references: [users.id],
    }),
    toUser: one(users, {
      fields: [projectTransfers.toUserId],
      references: [users.id],
    }),
  })
);

export const projectDownloadsRelations = relations(
  projectDownloads,
  ({ one }) => ({
    project: one(projects, {
      fields: [projectDownloads.projectId],
      references: [projects.id],
    }),
    user: one(users, {
      fields: [projectDownloads.userId],
      references: [users.id],
    }),
  })
);

export const projectReviewsRelations = relations(projectReviews, ({ one }) => ({
  project: one(projects, {
    fields: [projectReviews.projectId],
    references: [projects.id],
  }),
  user: one(users, {
    fields: [projectReviews.userId],
    references: [users.id],
  }),
}));

export const commentsRelations = relations(comments, ({ one, many }) => ({
  author: one(users, {
    fields: [comments.authorId],
    references: [users.id],
  }),
  parent: one(comments, {
    fields: [comments.parentId],
    references: [comments.id],
    relationName: "comment_replies",
  }),
  replies: many(comments, { relationName: "comment_replies" }),
  post: one(posts, {
    fields: [comments.postId],
    references: [posts.id],
  }),
  review: one(projectReviews, {
    fields: [comments.reviewId],
    references: [projectReviews.id],
  }),
}));

export const commentHeartsRelations = relations(commentHearts, ({ one }) => ({
  comment: one(comments, {
    fields: [commentHearts.commentId],
    references: [comments.id],
  }),
  user: one(users, {
    fields: [commentHearts.userId],
    references: [users.id],
  }),
}));

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
