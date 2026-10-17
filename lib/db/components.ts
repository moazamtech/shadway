import { connectToDatabase } from "@/lib/mongodb";
import { ObjectId, type Sort } from "mongodb";

export type ComponentVisibility = "public" | "unlisted" | "private";
export type ComponentStatus = "draft" | "pending" | "published" | "hidden" | "flagged";

export type ComponentFile = {
  path: string;
  content: string;
  type: string;
  target?: string;
};

export type ComponentAuthor = {
  userId: string;
  name: string;
  username: string;
  avatar?: string;
};

export type ComponentDocument = {
  _id?: ObjectId;
  slug: string;
  name: string;
  title: string;
  description: string;
  code: string;
  /** Where the author keeps the component. Defaults to `components/component.tsx`. */
  componentPath?: string;
  demoCode?: string;
  /** The project stylesheet (`app/globals.css`) the author edited. */
  styleCode?: string;
  previewHtml?: string;
  previewHash?: string;
  /** The build version `previewHtml` came from — see `PREVIEW_BUILD_VERSION`. */
  previewVersion?: number;
  thumbnailUrl?: string;
  videoUrl?: string;
  assets?: { url: string; type: string }[];
  files?: ComponentFile[];
  category: string;
  tags: string[];
  dependencies: string[];
  devDependencies: string[];
  registryDependencies: string[];
  cssVars?: Record<string, Record<string, string>>;
  author: ComponentAuthor;
  visibility: ComponentVisibility;
  status: ComponentStatus;
  installs: number;
  views: number;
  likes: number;
  bookmarks?: number;
  featured: boolean;
  version: string;
  parentSlug?: string;
  license: string;
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;
  lastDownloadedAt?: Date;
};

export type ComponentInput = Omit<
  ComponentDocument,
  "_id" | "slug" | "installs" | "views" | "likes" | "createdAt" | "updatedAt" | "publishedAt" | "lastDownloadedAt"
> & {
  slug?: string;
};

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function isValidSlug(slug: string): boolean {
  return SLUG_RE.test(slug) && slug.length > 2 && slug.length < 90;
}

/**
 * The raw collection, with no index bookkeeping.
 *
 * `ensureComponentIndexes` needs this; `getComponentsCollection` wraps it.
 */
async function getComponentsCollectionRaw() {
  const { db } = await connectToDatabase();
  return db.collection<ComponentDocument>("components");
}

export async function getComponentsCollection() {
  const collection = await getComponentsCollectionRaw();
  // Indexes are built once per process on first use, so every caller gets a
  // correctly-indexed collection without having to remember to migrate first.
  await ensureComponentIndexes();
  return collection;
}

/**
 * Whether the component indexes have been built in this process.
 *
 * Index creation is a schema migration, not per-request work: `createIndexes`
 * is idempotent but it is still a round trip, and the feed calls into this
 * collection on every request. Creating once per process keeps the first
 * request after a restart correct without paying for it forever.
 */
let indexesReady = false;

export async function ensureComponentIndexes(): Promise<void> {
  if (indexesReady) return;

  // Raw accessor on purpose: going through getComponentsCollection here would
  // recurse infinitely.
  const collection = await getComponentsCollectionRaw();

  const wanted: { key: Record<string, 1 | -1 | "text">; unique?: boolean }[] = [
    { key: { slug: 1 }, unique: true },
    { key: { name: 1 } },
    // The feed's author filter and the profile pages.
    { key: { "author.username": 1 } },
    // The default feed query: published + public, newest first.
    { key: { status: 1, visibility: 1, createdAt: -1 } },
    { key: { tags: 1 } },
    // The existing deployment already carries this index with `name` in the
    // weights; including it keeps the spec identical so createIndexes is a
    // no-op rather than an IndexOptionsConflict.
    { key: { title: "text", description: "text", tags: "text", name: "text" } },
    // Sorting by installs for the "most installed" view.
    { key: { installs: -1, createdAt: -1 } },
    // Sorting by likes for the "popular" view.
    { key: { likes: -1, createdAt: -1 } },
  ];

  // A collection that already carries an index with the same name but different
  // options makes `createIndexes` fail the whole batch with
  // IndexOptionsConflict (code 85) — which would take the feed down, not just
  // the index. Diff against what exists and create only what is missing or
  // differs, so a pre-existing deployment converges instead of erroring.
  const existing = await collection.indexes();
  const pending = wanted.filter((index) => {
    // Match by key pattern, not by name: the deployment already carries these
    // indexes under MongoDB's auto-generated names, so a name lookup would
    // never find them and every request would try to recreate them.
    const current = existing.find(
      (entry) => JSON.stringify(entry.key) === JSON.stringify(index.key)
    );
    if (!current) return true;
    // Compare the key pattern and the flags that actually change behaviour.
    return (
      JSON.stringify(current.key) !== JSON.stringify(index.key) ||
      Boolean(current.unique) !== Boolean(index.unique)
    );
  });

  for (const index of pending) {
    try {
      await collection.createIndex(index.key, index);
    } catch (error) {
      // Never let an index problem become a request failure: the query still
      // works, it is just slower until the schema is reconciled.
      console.error(
        `Failed to create component index ${JSON.stringify(index.key)}:`,
        error
      );
    }
  }

  indexesReady = true;
}

/** Reset the in-process guard. For tests that rebuild the collection. */
export function resetComponentIndexes(): void {
  indexesReady = false;
}

export type ListComponentsOptions = {
  q?: string;
  tag?: string;
  category?: string;
  author?: string;
  status?: ComponentStatus;
  sort?: "latest" | "popular" | "trending" | "installs";
  limit?: number;
  cursor?: string;
};

const DEFAULT_LIMIT = 24;
/** Hard ceiling: a page of cards must stay bounded no matter what is asked. */
export const MAX_PAGE_SIZE = 60;

/**
 * The sort key, plus a tiebreaker so the ordering is total.
 *
 * A cursor can only skip documents when the sort is unambiguous. `createdAt`
 * alone is not — two components published in the same millisecond would be
 * ordered arbitrarily between requests, and a page boundary could then drop
 * or repeat one. `_id` is unique and stable, so it is always appended.
 */
type SortKeys = Record<string, 1 | -1>;

function sortSpecFor(
  sort: ListComponentsOptions["sort"]
): { sort: SortKeys; tiebreaker: 1 | -1 } {
  switch (sort) {
    case "popular":
      return { sort: { likes: -1, views: -1 }, tiebreaker: -1 };
    case "installs":
      return { sort: { installs: -1 }, tiebreaker: -1 };
    case "trending":
      return { sort: { views: -1, installs: -1 }, tiebreaker: -1 };
    default:
      return { sort: { createdAt: -1 }, tiebreaker: -1 };
  }
}

/** Decode an opaque cursor back into the sort values it points past. */
function decodeCursor<T>(cursor: string): T | null {
  try {
    const json = Buffer.from(cursor, "base64url").toString("utf8");
    return JSON.parse(json) as T;
  } catch {
    // A tampered or truncated cursor must not take down the feed; treat it as
    // "start from the beginning" rather than erroring.
    return null;
  }
}

export type ComponentPage = {
  items: ComponentDocument[];
  /** Opaque cursor for the next page, or null when this is the last one. */
  nextCursor: string | null;
  /** True when more results exist beyond this page. */
  hasMore: boolean;
};

/**
 * A flat page of published components.
 *
 * Kept returning a plain array so the many callers that only need rows keep
 * working unchanged; `listComponentsPage` below is the cursor-paginated form
 * for the surfaces that actually page.
 */
export async function listComponents(
  options: ListComponentsOptions = {}
): Promise<ComponentDocument[]> {
  const { items } = await listComponentsPage(options);
  return items;
}

/**
 * A page of published components, newest first by default.
 *
 * Cursor-paginated rather than offset-paginated: an offset asks the database to
 * count and discard every document before the window, so page 500 of a large
 * registry costs as much as the first 500 pages combined. A cursor seeks
 * straight to the boundary.
 *
 * `hasMore` is derived by asking for one extra document, which keeps the
 * "is there a next page?" question free.
 */
export async function listComponentsPage(
  options: ListComponentsOptions = {}
): Promise<ComponentPage> {
  const collection = await getComponentsCollection();
  const limit = Math.min(
    Math.max(options.limit ?? DEFAULT_LIMIT, 1),
    MAX_PAGE_SIZE
  );

  const filter: Record<string, unknown> = {
    status: options.status ?? "published",
    visibility: "public",
  };

  if (options.tag) filter.tags = options.tag;
  if (options.category) filter.category = options.category;
  if (options.author) filter["author.username"] = options.author;

  if (options.q && options.q.trim()) {
    const query = options.q.trim();
    filter.$or = [
      { title: { $regex: query, $options: "i" } },
      { description: { $regex: query, $options: "i" } },
      { tags: { $regex: query, $options: "i" } },
      { name: { $regex: query, $options: "i" } },
    ];
  }

  const { sort, tiebreaker } = sortSpecFor(options.sort);
  const orderBy: Sort = { ...sort, _id: tiebreaker };

  // Seek past the cursor's sort position rather than counting documents.
  //
  // The pagination clause is ANDed with everything else and lives under its own
  // `$and` entry, so it never has to share the `$or` that a text search may
  // already occupy — two sibling `$or` keys would silently overwrite.
  if (options.cursor) {
    const cursor = decodeCursor<Record<string, unknown>>(options.cursor);
    if (cursor) {
      const clauses = Object.entries(sort).map(([field, direction]) => ({
        [field]: direction === -1 ? { $lt: cursor[field] } : { $gt: cursor[field] },
      }));
      filter.$and = [...((filter.$and as unknown[]) ?? []), { $or: clauses }];
    }
  }

  const rows = await collection
    .find(filter)
    .sort(orderBy)
    .limit(limit + 1)
    .toArray();

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;

  const last = items[items.length - 1];
  const nextCursor =
    hasMore && last
      ? Buffer.from(
          JSON.stringify({
            createdAt: last.createdAt,
            likes: last.likes,
            views: last.views,
            installs: last.installs,
            _id: last._id?.toString(),
          }),
          "utf8"
        ).toString("base64url")
      : null;

  return { items, nextCursor, hasMore };
}


export async function getComponentBySlug(slug: string) {
  const collection = await getComponentsCollection();
  return collection.findOne({ slug, status: "published" });
}

/**
 * Any component by slug, drafts included — for the owner's own surfaces
 * (the dashboard and the studio), never for the public feed.
 */
export async function getComponentBySlugAnyStatus(slug: string) {
  const collection = await getComponentsCollection();
  return collection.findOne({ slug });
}

/** Everything one author owns, drafts first, newest first. */
export async function listUserComponents(userId: string, limit = 60) {
  const collection = await getComponentsCollection();
  return collection
    .find({ "author.userId": userId })
    .sort({ status: 1, updatedAt: -1 })
    .limit(Math.min(Math.max(limit, 1), 200))
    .toArray();
}

/**
 * Fetches published components by slug, keeping the order the slugs were
 * given in — which is what a bookmarks list, stored newest-first, needs.
 */
export async function listComponentsBySlugs(slugs: string[]) {
  if (!slugs.length) return [];
  const wanted = slugs.slice(0, 60);
  const collection = await getComponentsCollection();
  const rows = await collection
    .find({
      slug: { $in: wanted },
      status: "published",
      visibility: "public",
    })
    .toArray();
  const bySlug = new Map(rows.map((row) => [row.slug, row]));
  const ordered = [];
  for (const slug of wanted) {
    const row = bySlug.get(slug);
    if (row) ordered.push(row);
  }
  return ordered;
}

export async function createComponent(input: ComponentInput) {
  const collection = await getComponentsCollection();
  const now = new Date();

  const baseSlug = input.slug ? slugify(input.slug) : slugify(input.title || input.name);
  if (!isValidSlug(baseSlug)) {
    throw new Error("Invalid component slug");
  }

  const existing = await collection.findOne({ slug: baseSlug });
  const slug = existing ? `${baseSlug}-${Date.now().toString(36)}` : baseSlug;

  const doc: ComponentDocument = {
    slug,
    name: (input.name || baseSlug).replace(/[^a-zA-Z0-9-_]/g, "-"),
    title: input.title || input.name || baseSlug,
    description: input.description || "",
    code: input.code,
    componentPath: input.componentPath,
    demoCode: input.demoCode,
    styleCode: input.styleCode,
    thumbnailUrl: input.thumbnailUrl,
    videoUrl: input.videoUrl,
    assets: input.assets,
    files: input.files,
    category: input.category || "ui",
    tags: (input.tags || []).map((t) => t.trim()).filter(Boolean),
    dependencies: input.dependencies || [],
    devDependencies: input.devDependencies || [],
    registryDependencies: input.registryDependencies || [],
    cssVars: input.cssVars,
    author: input.author,
    visibility: input.visibility || "public",
    status: input.status || "published",
    installs: 0,
    views: 0,
    likes: 0,
    featured: Boolean(input.featured),
    version: input.version || "1.0.0",
    parentSlug: input.parentSlug,
    license: input.license || "MIT",
    createdAt: now,
    updatedAt: now,
    publishedAt:
      (input.status || "published") === "published" ? now : undefined,
  };

  const result = await collection.insertOne(doc);
  return { ...doc, _id: result.insertedId };
}

export async function incrementComponentMetric(
  slug: string,
  metric: "views" | "installs" | "likes"
) {
  const collection = await getComponentsCollection();
  await collection.updateOne({ slug }, { $inc: { [metric]: 1 }, $set: { updatedAt: new Date() } });
}
