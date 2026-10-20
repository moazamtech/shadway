import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * The schema.
 *
 * The data was written for Mongo, and the shapes here are the shapes that were
 * written — a component still carries its author's record, its files and its
 * metrics, and a user still carries a handle. What changed is where the bytes
 * live and what enforces the rules: a unique index on a handle is a promise
 * the database keeps, and a column of `jsonb` is a place a document that has
 * no shape of its own can live without pretending to be a table.
 *
 * The names are the same as the collections they replace, in snake_case, so
 * the migration is a translation rather than a rewrite.
 */

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    /** The hash, never the password. */
    password: text("password").notNull(),
    name: text("name"),
    /** The public handle a profile lives at. */
    username: text("username"),
    /** The profile picture, delivered from the CDN. */
    avatar: text("avatar"),
    bio: text("bio"),
    website: text("website"),
    twitter: text("twitter"),
    github: text("github"),
    role: text("role").notNull().default("user"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("users_email_key").on(table.email),
    uniqueIndex("users_username_key").on(table.username),
  ],
);

export const components = pgTable(
  "components",
  {
    id: text("id").primaryKey(),
    /** The registry address: `/r/<slug>`. */
    slug: text("slug").notNull(),
    name: text("name"),
    title: text("title").notNull(),
    description: text("description"),
    /** The author's source. */
    code: text("code").notNull().default(""),
    demoCode: text("demoCode"),
    styleCode: text("styleCode"),
    thumbnailUrl: text("thumbnailUrl"),
    videoUrl: text("videoUrl"),
    assets: jsonb("assets").$type<Record<string, string>>(),
    /** The author's whole project, as a path-to-source map. */
    files: jsonb("files").$type<Record<string, string>>(),
    category: text("category").notNull().default("ui"),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    dependencies: jsonb("dependencies").$type<string[]>().notNull().default([]),
    devDependencies: jsonb("devDependencies").$type<string[]>().notNull().default([]),
    registryDependencies: jsonb("registryDependencies")
      .$type<string[]>()
      .notNull()
      .default([]),
    cssVars: jsonb("cssVars").$type<Record<string, string>>(),
    /**
     * The author's record, denormalised.
     *
     * The feed draws thirty cards without thirty account lookups, and that is
     * worth the copy — but a copy is a copy, so it is written from the account
     * whenever the account changes.
     */
    author: jsonb("author")
      .$type<{
        userId: string;
        name: string;
        username: string;
        avatar?: string | null;
      }>()
      .notNull(),
    visibility: text("visibility").notNull().default("public"),
    status: text("status").notNull().default("draft"),
    installs: integer("installs").notNull().default(0),
    views: integer("views").notNull().default(0),
    likes: integer("likes").notNull().default(0),
    bookmarks: integer("bookmarks").notNull().default(0),
    featured: boolean("featured").notNull().default(false),
    version: text("version"),
    parentSlug: text("parentSlug"),
    license: text("license"),
    componentPath: text("componentPath"),
    /** The name of the built preview. */
    previewHash: text("previewHash"),
    /** The built document. Large, and only read by the preview route. */
    previewHtml: text("previewHtml"),
    previewVersion: integer("previewVersion"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("components_slug_key").on(table.slug),
    /**
     * The author is a record, and the two things anyone looks up in it are
     * the handle and the account.
     *
     * The index is on the *values* rather than on the whole record: an index
     * on the record itself would be a copy of every author's name and picture
     * in the table, and a lookup by handle would still have to read the whole
     * record to find out. Postgres indexes an expression, so the index is
     * written against the value — the two of them are created by
     * `scripts/db-indexes.ts`, because a schema diff cannot carry an
     * expression and a push would drop it.
     */
    index("components_author_username_idx").on(sql`(${table.author}->>'username')`),
    index("components_author_user_id_idx").on(sql`(${table.author}->>'userId')`),
    index("components_feed_idx").on(table.status, table.visibility, table.createdAt),
  ],
);

export const componentBookmarks = pgTable(
  "component_bookmarks",
  {
    userId: text("user_id").notNull(),
    slug: text("slug").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.slug] }),
    index("component_bookmarks_user_idx").on(table.userId),
  ],
);

export const componentVotes = pgTable(
  "component_votes",
  {
    userId: text("user_id").notNull(),
    slug: text("slug").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.slug] }),
    index("component_votes_slug_idx").on(table.slug),
  ],
);

export const collections = pgTable(
  "collections",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    componentSlugs: jsonb("componentSlugs").$type<string[]>().notNull().default([]),
    curatorName: text("curatorName"),
    curatorId: text("curatorId"),
    featured: boolean("featured").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("collections_slug_key").on(table.slug)],
);

export const templates = pgTable(
  "templates",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    image: text("image"),
    demoUrl: text("demoUrl"),
    purchaseUrl: text("purchaseUrl"),
    /** A price, in cents, or null for a free template. */
    price: integer("price"),
    featured: boolean("featured").notNull().default(false),
    sequence: integer("sequence").notNull().default(0),
    downloads: integer("downloads").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
);

export const websites = pgTable(
  "websites",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    url: text("url"),
    image: text("image"),
    category: text("category"),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    featured: boolean("featured").notNull().default(false),
    sequence: integer("sequence").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("websites_category_idx").on(table.category)],
);

export const vibecode = pgTable(
  "vibecode",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    description: text("description"),
    slug: text("slug").notNull(),
    prompt: text("prompt"),
    category: text("category"),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    thumbnailUrl: text("thumbnailUrl"),
    code: text("code"),
    files: jsonb("files").$type<Record<string, string>>(),
    entryFile: text("entryFile"),
    language: text("language"),
    status: text("status").notNull().default("draft"),
    viewCount: integer("view_count").notNull().default(0),
    /**
     * Who made it.
     *
     * A record rather than an id: the community gallery shows the author's
     * name beside a drop, and a drop whose author is gone should still say
     * who wrote it.
     */
    createdBy: jsonb("created_by").$type<{
      id: string;
      name: string;
      email: string;
    }>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
  },
  (table) => [uniqueIndex("vibecode_slug_key").on(table.slug)],
);

export const submissions = pgTable(
  "submissions",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    websiteName: text("websiteName"),
    websiteUrl: text("websiteUrl"),
    description: text("description"),
    category: text("category"),
    githubUrl: text("githubUrl"),
    status: text("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("submissions_status_idx").on(table.status)],
);

export const config = pgTable("config", {
  id: text("id").primaryKey(),
  value: jsonb("value"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ------------------------------------------------------------------ payouts -- */

export const payoutAccruals = pgTable(
  "payout_accruals",
  {
    id: text("id").primaryKey(),
    creatorId: text("creator_id").notNull(),
    username: text("username"),
    componentSlug: text("component_slug"),
    /** Gross attributable revenue, in USDC minor units. */
    amountMinor: text("amount_minor").notNull(),
    reason: text("reason").notNull(),
    source: text("source").notNull(),
    sourceId: text("source_id").notNull(),
    /** The batch that claimed it, if any. */
    batchId: text("batch_id"),
    status: text("status").notNull().default("accrued"),
    note: text("note"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("payout_accruals_idempotency_key").on(table.source, table.sourceId),
    index("payout_accruals_creator_idx").on(table.creatorId, table.occurredAt),
    index("payout_accruals_batch_idx").on(table.batchId),
  ],
);

export const payoutAccounts = pgTable(
  "payout_accounts",
  {
    creatorId: text("creator_id").primaryKey(),
    address: text("address").notNull(),
    chain: text("chain").notNull().default("base"),
    status: text("status").notNull().default("pending"),
    requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    verifiedBy: text("verified_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
);

export const payoutBatches = pgTable(
  "payout_batches",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    creatorId: text("creator_id").notNull(),
    username: text("username"),
    currency: text("currency").notNull().default("USDC"),
    chain: text("chain").notNull().default("base"),
    toAddress: text("to_address").notNull(),
    /** Minor units, as text: the arithmetic is on bigints, not doubles. */
    totalMinor: text("total_minor").notNull(),
    grossMinor: text("gross_minor").notNull(),
    roundingRemainder: text("rounding_remainder").notNull().default("0"),
    eventCount: integer("event_count").notNull().default(0),
    status: text("status").notNull().default("planned"),
    txHash: text("tx_hash"),
    nonce: integer("nonce"),
    failureReason: text("failure_reason"),
    periodStart: timestamp("period_start", { withTimezone: true }),
    periodEnd: timestamp("period_end", { withTimezone: true }),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    signedAt: timestamp("signed_at", { withTimezone: true }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("payout_batches_run_creator_key").on(table.runId, table.creatorId),
    index("payout_batches_creator_idx").on(table.creatorId, table.createdAt),
  ],
);

export const schema = {
  users,
  components,
  componentBookmarks,
  componentVotes,
  collections,
  templates,
  websites,
  vibecode,
  submissions,
  config,
  payoutAccruals,
  payoutAccounts,
  payoutBatches,
};
