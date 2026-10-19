import { connectToDatabase } from "@/lib/mongodb";
import { ObjectId, type Document, type Sort } from "mongodb";
import { isValidSlug, slugify } from "@/lib/component-slug";
import { storedCategoriesFor } from "@/lib/categories";

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

/**
 * What a listing selects.
 *
 * A stored component is heavy on purpose: it carries the author's source, the
 * whole project, and the prebuilt preview document. Added up, that is a couple
 * of hundred kilobytes per record — paid on the database round trip, in BSON
 * decoded in memory, and again on the wire — before a single card is drawn.
 *
 * A feed asks for thirty of them to paint a grid of images, so every listing
 * projects to the fields below. The heavy fields are read only by the routes
 * that actually compile or display them, which fetch a document on its own.
 */
export const CARD_FIELDS = {
  slug: 1,
  title: 1,
  description: 1,
  thumbnailUrl: 1,
  videoUrl: 1,
  category: 1,
  tags: 1,
  author: 1,
  installs: 1,
  views: 1,
  likes: 1,
  featured: 1,
  visibility: 1,
  status: 1,
  createdAt: 1,
  updatedAt: 1,
  publishedAt: 1,
  // Cursors are built from the tiebreaker, so it travels with the row.
  _id: 1,
} as const;

/** A row from a listing: the card's fields, and nothing else. */
export type ComponentCardDocument = Pick<
  ComponentDocument,
  keyof typeof CARD_FIELDS
>;

/**
 * A whole component minus the prebuilt preview document.
 *
 * The detail surfaces read the author's source, never the built HTML: the code
 * tab displays it and the preview iframe fetches it as its own document from
 * `app/api/components/preview`. Selecting `previewHtml` here would put the
 * largest field in the record on a request that never looks at it.
 */
export const SOURCE_FIELDS = {
  previewHtml: 0,
  previewHash: 0,
  previewVersion: 0,
} as const;

/**
 * The slug rules live in `lib/component-slug.ts`, where a client component can
 * reach them too.
 *
 * They used to live here, which meant the publish panel — that has to show an
 * author whether their URL is usable before they submit it — could not import
 * them, because this module opens a Mongo connection at the top. So it
 * re-implemented the slugifier inline, and the copy drifted: no `.trim()`, no
 * trailing-hyphen repair after truncation, and a different length ceiling.
 *
 * Re-exported as well as imported, because a dozen server modules already reach
 * for them from here.
 */
export { slugify, isValidSlug };

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
    // One author's public catalogue: the filter the profile pages use, ordered
    // the way they render it. Appended rather than folded into the two indexes
    // above on purpose — `createIndexes` matches on the key pattern, so
    // reworking an existing entry turns a no-op into an IndexOptionsConflict
    // (code 85) that takes the whole batch down with it, feed included.
    { key: { "author.username": 1, status: 1, visibility: 1, createdAt: -1 } },
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
  items: ComponentCardDocument[];
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
): Promise<ComponentCardDocument[]> {
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
  if (options.category) {
    /**
     * Expanded to the whole equivalence class, not matched literally.
     *
     * Every component in the database is stored under one of the ad-hoc names
     * the taxonomy absorbed — `block`, `hero`, `pricing`, `animation` — while
     * the links the UI renders are the canonical group slugs. A literal match
     * therefore returned nothing for every component published before the
     * taxonomy existed, and the page said so in two places at once: the chip
     * was selected, the header counted the items, and the grid beneath was
     * empty. Two wrong numbers are harder to trust than one, and the reader has
     * no way to tell which one to believe.
     *
     * `storedCategoriesFor` is the query-side twin of `normalizeGroup`, and
     * lives beside it so the taxonomy stays the only place that knows which old
     * names exist.
     */
    filter.category = { $in: storedCategoriesFor(options.category) };
  }
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
    .find(filter, { projection: CARD_FIELDS })
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
 *
 * The full document by default; the detail route asks for the source
 * projection when it has no use for the prebuilt preview document.
 */
export async function getComponentBySlugAnyStatus(
  slug: string,
  options: { projection?: Record<string, 0 | 1> } = {}
) {
  const collection = await getComponentsCollection();
  return collection.findOne(
    { slug },
    options.projection ? { projection: options.projection } : {}
  );
}

/** Everything one author owns, drafts first, newest first. */
export async function listUserComponents(
  userId: string,
  limit = 60
): Promise<ComponentCardDocument[]> {
  const collection = await getComponentsCollection();
  return collection
    .find({ "author.userId": userId }, { projection: CARD_FIELDS })
    .sort({ status: 1, updatedAt: -1 })
    .limit(Math.min(Math.max(limit, 1), 200))
    .toArray();
}

/**
 * Keeps the author record on a creator's components in step with their account.
 *
 * A component carries a denormalised copy of its author — name, handle and
 * picture — so the feed can draw thirty cards without thirty account lookups.
 * The price of that copy is that it goes stale: an author who replaces their
 * photo would keep the old one on every card they have ever published, and on
 * the detail page, until each component was touched again.
 *
 * So the account is the truth and the copies follow it. This is called when a
 * picture is uploaded or removed; an empty string clears it, which the readers
 * already treat as "no picture" (they fall back to the handle's initials).
 */
export async function syncAuthorAvatar(
  userId: string,
  avatar?: string | null,
): Promise<void> {
  const collection = await getComponentsCollection();
  await collection.updateMany(
    { "author.userId": userId },
    { $set: { "author.avatar": avatar ?? "" } },
  );
}

/**
 * Fetches published components by slug, keeping the order the slugs were
 * given in — which is what a bookmarks list, stored newest-first, needs.
 */
export async function listComponentsBySlugs(
  slugs: string[]
): Promise<ComponentCardDocument[]> {
  if (!slugs.length) return [];
  const wanted = slugs.slice(0, 60);
  const collection = await getComponentsCollection();
  const rows = await collection
    .find(
      {
        slug: { $in: wanted },
        status: "published",
        visibility: "public",
      },
      { projection: CARD_FIELDS }
    )
    .toArray();
  const bySlug = new Map(rows.map((row) => [row.slug, row]));
  const ordered: ComponentCardDocument[] = [];
  for (const slug of wanted) {
    const row = bySlug.get(slug);
    if (row) ordered.push(row);
  }
  return ordered;
}

export type AuthorStats = {
  components: number;
  views: number;
  likes: number;
  installs: number;
};

/** What an author who has published nothing reads as. */
export const EMPTY_AUTHOR_STATS: AuthorStats = {
  components: 0,
  views: 0,
  likes: 0,
  installs: 0,
};

/**
 * The aggregation behind `getAuthorStats`, exported so a test can pin it.
 *
 * The filter here has to stay the same one `listComponentsPage` applies. They
 * are two separate spellings of "published, public, this author" written in
 * two files, and the day they disagree the profile quietly reports totals for
 * work the grid will never show — which is the bug this replaced, wearing a
 * different hat. A test is cheaper than noticing.
 */
export function authorStatsPipeline(handle: string): Document[] {
  return [
    {
      $match: {
        "author.username": handle,
        status: "published",
        visibility: "public",
      },
    },
    {
      $group: {
        _id: null,
        components: { $sum: 1 },
        views: { $sum: { $ifNull: ["$views", 0] } },
        likes: { $sum: { $ifNull: ["$likes", 0] } },
        installs: { $sum: { $ifNull: ["$installs", 0] } },
      },
    },
  ];
}

/**
 * One author's totals, counted by the database.
 *
 * The profile pages used to add these up in JavaScript, over a page of cards
 * capped at `MAX_PAGE_SIZE`. That cap is the whole bug: an author past sixty
 * items was reported with exactly sixty of them, in the stat tiles *and* in
 * the tab badge beside them — a page that contradicts itself about how much
 * work exists, and gets it wrong in the direction that flatters nobody's
 * numbers. A `$group` over the matching documents has no ceiling.
 *
 * `$ifNull` because the counters are denormalised onto the document and the
 * older records predate them; without it a missing field would drop the whole
 * sum for that author rather than count as zero.
 *
 * One aggregation rather than four `countDocuments`/sums: a profile page is a
 * hot path (it is in the sitemap, so crawlers hit it), and four round trips
 * per render is four chances for one of them to be slower than the rest.
 */
export async function getAuthorStats(handle: string): Promise<AuthorStats> {
  const collection = await getComponentsCollection();

  const [row] = await collection
    .aggregate<AuthorStats>(authorStatsPipeline(handle))
    .toArray();

  // A `$group` over zero documents emits no row at all, so an author who has
  // not published is the empty set rather than a row of nulls.
  if (!row) return EMPTY_AUTHOR_STATS;

  return {
    components: row.components ?? 0,
    views: row.views ?? 0,
    likes: row.likes ?? 0,
    installs: row.installs ?? 0,
  };
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
