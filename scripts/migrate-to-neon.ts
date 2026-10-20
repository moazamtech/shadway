import "dotenv/config";
import { MongoClient, ObjectId } from "mongodb";
import { eq } from "drizzle-orm";

import { db } from "../lib/db/postgres";
import {
  collections,
  componentBookmarks,
  componentVotes,
  components,
  config,
  payoutAccruals,
  payoutAccounts,
  payoutBatches,
  submissions,
  templates,
  users,
  vibecode,
  websites,
} from "../lib/db/schema";

/**
 * Move the data to Postgres.
 *
 * The catalogue was written for Mongo, and it is moving to a relational
 * database without being rewritten: the same documents, the same names, the
 * same ids. The script reads every collection and writes it out, and it is
 * safe to run twice — a row that is already there is left alone, so a run
 * that was interrupted can simply be run again.
 *
 * The ids stay the same, and the ids are what everything else refers to: a
 * component's author, a bookmark's user, an accrual's creator. Changing them
 * here would change them everywhere.
 *
 *   npx tsx scripts/migrate-to-neon.ts            # migrate
 *   npx tsx scripts/migrate-to-neon.ts --dry-run  # count only
 */

const DRY = process.argv.includes("--dry-run");
const MONGO_DB = "shadcn-hub";

type Doc = Record<string, unknown>;

function idOf(value: unknown): string {
  if (value instanceof ObjectId) return value.toHexString();
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "_id" in value) {
    const inner = (value as Doc)._id;
    if (inner instanceof ObjectId) return inner.toHexString();
    if (typeof inner === "string") return inner;
  }
  return String(value ?? "");
}

function dateOf(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

function dateOr(value: unknown, fallback: Date): Date {
  return dateOf(value) ?? fallback;
}

function str(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return null;
  return String(value);
}

function num(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function bool(value: unknown): boolean {
  return value === true;
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function record(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value as Doc)) {
    if (typeof entry === "string") out[key] = entry;
  }
  return out;
}

/**
 * An author, which is a record and not an id.
 *
 * The gallery shows the name beside a drop, so the name travels with the
 * document rather than being looked up — a drop whose author has since
 * deleted their account still says who wrote it.
 */
function authorOf(value: unknown): { id: string; name: string; email: string } {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const doc = value as Doc;
    return {
      id: str(doc.id) ?? "",
      name: str(doc.name) ?? "",
      email: str(doc.email) ?? "",
    };
  }
  return { id: str(value) ?? "", name: "", email: "" };
}

async function main() {
  const mongo = await MongoClient.connect(process.env.MONGODB_URI!);
  const source = mongo.db(MONGO_DB);
  const target = db();

  const report: string[] = [];
  const note = (line: string) => {
    report.push(line);
    console.log(line);
  };

  /* ------------------------------------------------------------------ users -- */
  {
    const rows = await source.collection("users").find({}).toArray();
    for (const row of rows) {
      const doc = row as Doc;
      const values = {
        id: idOf(doc._id),
        email: str(doc.email) ?? "",
        password: str(doc.password) ?? "",
        name: str(doc.name),
        username: str(doc.username),
        avatar: str(doc.avatar),
        bio: str(doc.bio),
        website: str(doc.website),
        twitter: str(doc.twitter),
        github: str(doc.github),
        role: str(doc.role) ?? "user",
        createdAt: dateOr(doc.createdAt, new Date()),
        updatedAt: dateOr(doc.updatedAt, new Date()),
      };
      if (DRY) {
        note(`users: ${rows.length} (dry run)`);
        continue;
      }
      await target
        .insert(users)
        .values(values as typeof users.$inferInsert)
        .onConflictDoUpdate({ target: users.id, set: values });
    }
    note(`users: ${rows.length}`);
  }

  /* ------------------------------------------------------------- components -- */
  {
    const rows = await source.collection("components").find({}).toArray();
    for (const row of rows) {
      const doc = row as Doc;
      const author = (doc.author ?? {}) as Doc;
      const values = {
        id: idOf(doc._id),
        slug: str(doc.slug) ?? "",
        name: str(doc.name),
        title: str(doc.title) ?? "",
        description: str(doc.description),
        code: str(doc.code) ?? "",
        demoCode: str(doc.demoCode),
        styleCode: str(doc.styleCode),
        thumbnailUrl: str(doc.thumbnailUrl),
        videoUrl: str(doc.videoUrl),
        assets: record(doc.assets),
        files: record(doc.files),
        category: str(doc.category) ?? "ui",
        tags: strings(doc.tags),
        dependencies: strings(doc.dependencies),
        devDependencies: strings(doc.devDependencies),
        registryDependencies: strings(doc.registryDependencies),
        cssVars: record(doc.cssVars),
        author: {
          userId: str(author.userId) ?? "",
          name: str(author.name) ?? "",
          username: str(author.username) ?? "",
          avatar: str(author.avatar),
        },
        visibility: str(doc.visibility) ?? "public",
        status: str(doc.status) ?? "draft",
        installs: num(doc.installs),
        views: num(doc.views),
        likes: num(doc.likes),
        bookmarks: num(doc.bookmarks),
        featured: bool(doc.featured),
        version: str(doc.version),
        parentSlug: str(doc.parentSlug),
        license: str(doc.license),
        componentPath: str(doc.componentPath),
        previewHash: str(doc.previewHash),
        previewHtml: str(doc.previewHtml),
        previewVersion:
          typeof doc.previewVersion === "number" ? doc.previewVersion : null,
        createdAt: dateOr(doc.createdAt, new Date()),
        updatedAt: dateOr(doc.updatedAt, new Date()),
        publishedAt: dateOf(doc.publishedAt),
      };
      if (DRY) {
        note(`components: ${rows.length} (dry run)`);
        continue;
      }
      await target
        .insert(components)
        .values(values as typeof components.$inferInsert)
        .onConflictDoUpdate({ target: components.id, set: values });
    }
    note(`components: ${rows.length}`);
  }

  /* --------------------------------------------------- bookmarks and likes -- */
  for (const [name, table] of [
    ["component_bookmarks", componentBookmarks],
    ["component_votes", componentVotes],
  ] as const) {
    const rows = await source.collection(name).find({}).toArray();
    for (const row of rows) {
      const doc = row as Doc;
      const values = {
        userId: idOf(doc.userId),
        slug: str(doc.slug) ?? "",
        createdAt: dateOr(doc.createdAt, new Date()),
      };
      if (DRY) continue;
      await target
        .insert(table)
        .values(values as typeof table.$inferInsert)
        .onConflictDoNothing();
    }
    note(`${name}: ${rows.length}`);
  }

  /* ------------------------------------------------------------ collections -- */
  {
    const rows = await source.collection("collections").find({}).toArray();
    for (const row of rows) {
      const doc = row as Doc;
      const values = {
        id: idOf(doc._id),
        slug: str(doc.slug) ?? "",
        title: str(doc.title) ?? "",
        description: str(doc.description),
        componentSlugs: strings(doc.componentSlugs),
        curatorName: str(doc.curatorName),
        curatorId: str(doc.curatorId),
        featured: bool(doc.featured),
        createdAt: dateOr(doc.createdAt, new Date()),
        updatedAt: dateOr(doc.updatedAt, new Date()),
      };
      if (DRY) continue;
      await target
        .insert(collections)
        .values(values as typeof collections.$inferInsert)
        .onConflictDoUpdate({ target: collections.id, set: values });
    }
    note(`collections: ${rows.length}`);
  }

  /* -------------------------------------------------------------- templates -- */
  {
    const rows = await source.collection("templates").find({}).toArray();
    for (const row of rows) {
      const doc = row as Doc;
      const price = doc.price;
      const values = {
        id: idOf(doc._id),
        name: str(doc.name) ?? "",
        description: str(doc.description),
        image: str(doc.image),
        demoUrl: str(doc.demoUrl),
        purchaseUrl: str(doc.purchaseUrl),
        price:
          typeof price === "number"
            ? price
            : price && typeof price === "object" && typeof (price as Doc).amount === "number"
              ? ((price as Doc).amount as number)
              : null,
        featured: bool(doc.featured),
        sequence: num(doc.sequence),
        downloads: num(doc.downloads),
        createdAt: dateOr(doc.createdAt, new Date()),
        updatedAt: dateOr(doc.updatedAt, new Date()),
      };
      if (DRY) continue;
      await target
        .insert(templates)
        .values(values as typeof templates.$inferInsert)
        .onConflictDoUpdate({ target: templates.id, set: values });
    }
    note(`templates: ${rows.length}`);
  }

  /* --------------------------------------------------------------- websites -- */
  {
    const rows = await source.collection("websites").find({}).toArray();
    for (const row of rows) {
      const doc = row as Doc;
      const values = {
        id: idOf(doc._id),
        name: str(doc.name) ?? "",
        description: str(doc.description),
        url: str(doc.url),
        image: str(doc.image),
        category: str(doc.category),
        tags: strings(doc.tags),
        featured: bool(doc.featured),
        sequence: num(doc.sequence),
        createdAt: dateOr(doc.createdAt, new Date()),
        updatedAt: dateOr(doc.updatedAt, new Date()),
      };
      if (DRY) continue;
      await target
        .insert(websites)
        .values(values as typeof websites.$inferInsert)
        .onConflictDoUpdate({ target: websites.id, set: values });
    }
    note(`websites: ${rows.length}`);
  }

  /* --------------------------------------------------------------- vibecode -- */
  {
    const rows = await source.collection("vibecode").find({}).toArray();
    for (const row of rows) {
      const doc = row as Doc;
      const values = {
        id: idOf(doc._id),
        title: str(doc.title) ?? "",
        description: str(doc.description),
        slug: str(doc.slug) ?? "",
        prompt: str(doc.prompt),
        category: str(doc.category),
        tags: strings(doc.tags),
        thumbnailUrl: str(doc.thumbnailUrl),
        code: str(doc.code),
        files: record(doc.files),
        entryFile: str(doc.entryFile),
        language: str(doc.language),
        status: str(doc.status) ?? "draft",
        viewCount: num(doc.viewCount),
        createdBy: authorOf(doc.createdBy),
        createdAt: dateOr(doc.createdAt, new Date()),
        updatedAt: dateOr(doc.updatedAt, new Date()),
        publishedAt: dateOf(doc.publishedAt),
      };
      if (DRY) continue;
      await target
        .insert(vibecode)
        .values(values as typeof vibecode.$inferInsert)
        .onConflictDoUpdate({ target: vibecode.id, set: values });
    }
    note(`vibecode: ${rows.length}`);
  }

  /* ------------------------------------------------------------ submissions -- */
  {
    const rows = await source.collection("submissions").find({}).toArray();
    for (const row of rows) {
      const doc = row as Doc;
      const values = {
        id: idOf(doc._id),
        name: str(doc.name) ?? "",
        email: str(doc.email) ?? "",
        websiteName: str(doc.websiteName),
        websiteUrl: str(doc.websiteUrl),
        description: str(doc.description),
        category: str(doc.category),
        githubUrl: str(doc.githubUrl),
        status: str(doc.status) ?? "pending",
        createdAt: dateOr(doc.createdAt, new Date()),
        updatedAt: dateOr(doc.updatedAt, new Date()),
      };
      if (DRY) continue;
      await target
        .insert(submissions)
        .values(values as typeof submissions.$inferInsert)
        .onConflictDoUpdate({ target: submissions.id, set: values });
    }
    note(`submissions: ${rows.length}`);
  }

  /* ----------------------------------------------------------------- config -- */
  {
    const rows = await source.collection("config").find({}).toArray();
    for (const row of rows) {
      const doc = row as Doc;
      const values = {
        id: idOf(doc._id),
        value: doc.value ?? null,
        updatedAt: dateOr(doc.updatedAt, new Date()),
      };
      if (DRY) continue;
      await target
        .insert(config)
        .values(values as typeof config.$inferInsert)
        .onConflictDoUpdate({ target: config.id, set: values });
    }
    note(`config: ${rows.length}`);
  }

  /* ---------------------------------------------------------------- payouts -- */
  {
    const accruals = await source.collection("payout_accruals").find({}).toArray();
    for (const row of accruals) {
      const doc = row as Doc;
      const values = {
        id: idOf(doc._id),
        creatorId: idOf(doc.creatorId),
        username: str(doc.username),
        componentSlug: str(doc.componentSlug),
        amountMinor: str(doc.amountMinor) ?? "0",
        reason: str(doc.reason) ?? "install",
        source: str(doc.source) ?? "admin",
        sourceId: str(doc.sourceId) ?? idOf(doc._id),
        batchId: str(doc.batchId),
        status: str(doc.status) ?? "accrued",
        note: str(doc.note),
        occurredAt: dateOr(doc.occurredAt, new Date()),
        createdAt: dateOr(doc.createdAt, new Date()),
      };
      if (DRY) continue;
      await target
        .insert(payoutAccruals)
        .values(values as typeof payoutAccruals.$inferInsert)
        .onConflictDoUpdate({ target: payoutAccruals.id, set: values });
    }
    note(`payout_accruals: ${accruals.length}`);

    const accounts = await source.collection("payout_accounts").find({}).toArray();
    for (const row of accounts) {
      const doc = row as Doc;
      const values = {
        creatorId: idOf(doc.creatorId),
        address: str(doc.address) ?? "",
        chain: str(doc.chain) ?? "base",
        status: str(doc.status) ?? "pending",
        requestedAt: dateOr(doc.requestedAt, new Date()),
        verifiedAt: dateOf(doc.verifiedAt),
        verifiedBy: str(doc.verifiedBy),
        createdAt: dateOr(doc.createdAt, new Date()),
        updatedAt: dateOr(doc.updatedAt, new Date()),
      };
      if (DRY) continue;
      await target
        .insert(payoutAccounts)
        .values(values as typeof payoutAccounts.$inferInsert)
        .onConflictDoNothing({ target: payoutAccounts.creatorId });
    }
    note(`payout_accounts: ${accounts.length}`);

    const batches = await source.collection("payout_batches").find({}).toArray();
    for (const row of batches) {
      const doc = row as Doc;
      const values = {
        id: idOf(doc._id),
        runId: str(doc.runId) ?? "",
        creatorId: idOf(doc.creatorId),
        username: str(doc.username),
        currency: str(doc.currency) ?? "USDC",
        chain: str(doc.chain) ?? "base",
        toAddress: str(doc.toAddress) ?? "",
        totalMinor: str(doc.totalMinor) ?? "0",
        grossMinor: str(doc.grossMinor) ?? "0",
        roundingRemainder: str(doc.roundingRemainder) ?? "0",
        eventCount: num(doc.eventCount),
        status: str(doc.status) ?? "planned",
        txHash: str(doc.txHash),
        nonce: typeof doc.nonce === "number" ? doc.nonce : null,
        failureReason: str(doc.failureReason),
        periodStart: dateOf(doc.periodStart),
        periodEnd: dateOf(doc.periodEnd),
        createdBy: str(doc.createdBy),
        createdAt: dateOr(doc.createdAt, new Date()),
        updatedAt: dateOr(doc.updatedAt, new Date()),
        signedAt: dateOf(doc.signedAt),
        submittedAt: dateOf(doc.submittedAt),
        confirmedAt: dateOf(doc.confirmedAt),
      };
      if (DRY) continue;
      await target
        .insert(payoutBatches)
        .values(values as typeof payoutBatches.$inferInsert)
        .onConflictDoUpdate({ target: payoutBatches.id, set: values });
    }
    note(`payout_batches: ${batches.length}`);
  }

  /* ------------------------------------------------------------------ proof -- */
  if (!DRY) {
    const migrated = await target.select({ id: components.id }).from(components);
    note(`\ncomponents in postgres: ${migrated.length}`);
    const one = await target
      .select({ slug: components.slug, title: components.title })
      .from(components)
      .where(eq(components.slug, "particles"))
      .limit(1);
    note(`spot check: ${JSON.stringify(one)}`);
  }

  await mongo.close();
  console.log("\n" + report.join("\n"));
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
