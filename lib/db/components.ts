import { randomBytes } from "node:crypto";

import { and, asc, desc, eq, inArray, or, sql, type SQL } from "drizzle-orm";
import type { AnyPgColumn, PgUpdateSetSource } from "drizzle-orm/pg-core";
import type { Document, Filter, ObjectId, Sort, WithId } from "mongodb";

import { storedCategoriesFor } from "../categories";
import { isValidSlug, slugify } from "../component-slug";

import { db } from "./postgres";
import { components } from "./schema";

/**
 * The catalogue.
 *
 * The documents are the documents Mongo held — a component carries its
 * author's source, the whole project and the prebuilt preview document — and
 * they live in a table now. The contract did not move: the feed reads the same
 * card, the detail page reads the same source, the registry builds the same
 * item from the same fields, and the ids are the text the migration carried
 * over rather than twenty-four bytes of object id.
 *
 * What moved is the storage, and with it the vocabulary the routes speak. They
 * still ask for a collection and still say `$set` and `$unset`, because that is
 * the vocabulary they were written against and because "put this here" and
 * "take that away" are two different intentions a single flat object cannot
 * express. The collection at the bottom of this file is that handle, pointed at
 * a table.
 */

/* -------------------------------------------------------------------------- */
/*                              The document                                   */
/* -------------------------------------------------------------------------- */

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
  /**
   * The row's id, as text.
   *
   * It was an `ObjectId` and the migration carried the same twenty-four
   * characters over, so a lookup compares the string the caller holds instead
   * of building an object id out of it. The type still admits an `ObjectId`
   * because the serializers that guard the server/client boundary are written
   * against one, and a document handed to them must still typecheck.
   */
  _id?: string | ObjectId;
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
  /**
   * Kept because it was in the document, and kept empty because nothing has
   * ever written it: the table has no column for it, and a field nobody writes
   * is a field nobody reads.
   */
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
  /**
   * The name of the built preview.
   *
   * A hash is a few characters, and it is what lets the preview be asked for
   * by name: a URL that carries the name of its contents cannot be stale, so
   * the browser keeps it and never comes back to ask whether it has changed.
   */
  previewHash: 1,
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
 * The fields a page needs to *show* a component.
 *
 * The built document is the one field too heavy to hand out: it is the whole
 * component, compiled, and it is served from its own address. The hash that
 * names that build is not heavy — it is a few characters — and a page that
 * knows it can ask for the document by name, which is what lets the browser
 * keep it forever instead of asking whether it has changed.
 */
export const DETAIL_FIELDS = {
  previewHtml: 0,
} as const;

/**
 * The slug rules live in `lib/component-slug.ts`, where a client component can
 * reach them too.
 *
 * They used to live here, which meant the publish panel — that has to show an
 * author whether their URL is usable before they submit it — could not import
 * them, because this module opened a Mongo connection at the top. So it
 * re-implemented the slugifier inline, and the copy drifted: no `.trim()`, no
 * trailing-hyphen repair after truncation, and a different length ceiling.
 *
 * Re-exported as well as imported, because a dozen server modules already reach
 * for them from here.
 */
export { slugify, isValidSlug };

/* -------------------------------------------------------------------------- */
/*                            The table, read as a document                     */
/* -------------------------------------------------------------------------- */

/**
 * Every field a document carries, and the column it is stored in.
 *
 * The names are the document's, not the table's: a document says `_id` and the
 * row says `id`, and everything else kept its name through the migration so
 * that the two could be read against each other. The map is also what a
 * projection is resolved against, which is why it lists every field rather
 * than the ones a card happens to want.
 */
const COLUMN_BY_FIELD = {
  _id: components.id,
  slug: components.slug,
  name: components.name,
  title: components.title,
  description: components.description,
  code: components.code,
  componentPath: components.componentPath,
  demoCode: components.demoCode,
  styleCode: components.styleCode,
  previewHtml: components.previewHtml,
  previewHash: components.previewHash,
  previewVersion: components.previewVersion,
  thumbnailUrl: components.thumbnailUrl,
  videoUrl: components.videoUrl,
  assets: components.assets,
  files: components.files,
  category: components.category,
  tags: components.tags,
  dependencies: components.dependencies,
  devDependencies: components.devDependencies,
  registryDependencies: components.registryDependencies,
  cssVars: components.cssVars,
  author: components.author,
  visibility: components.visibility,
  status: components.status,
  installs: components.installs,
  views: components.views,
  likes: components.likes,
  bookmarks: components.bookmarks,
  featured: components.featured,
  version: components.version,
  parentSlug: components.parentSlug,
  license: components.license,
  createdAt: components.createdAt,
  updatedAt: components.updatedAt,
  publishedAt: components.publishedAt,
} as const;

type DocumentField = keyof typeof COLUMN_BY_FIELD;

const ALL_FIELDS = Object.keys(COLUMN_BY_FIELD) as DocumentField[];

/**
 * The column behind a field, for the places a column is needed rather than a
 * name.
 *
 * The map above holds the columns themselves, so a projection can hand them
 * straight to the query builder and a condition can name them without a
 * lookup.
 */
function columnFor(field: DocumentField): AnyPgColumn {
  return COLUMN_BY_FIELD[field] as unknown as AnyPgColumn;
}

/**
 * The two fields that live inside the author's record.
 *
 * They are read with `->>` rather than compared as a whole, because the record
 * is a copy of an account and the two questions asked of it are always about
 * one of its keys: whose work is this, and who is its author.
 *
 * The key is written into the statement rather than bound. A group by has to
 * repeat the expression it groups by, and PostgreSQL compares the two as
 * text: two bindings of the same word are two expressions to it, and it would
 * refuse the grouping. The names are two fixed words, so nothing reaches the
 * statement that was not already there.
 */
function authorField(key: "username" | "userId"): SQL {
  return sql`${components.author}->>${sql.raw(`'${key}'`)}`;
}

/**
 * The registry type a file carries.
 *
 * The column keeps the path and the source, and the type is not one of the
 * two — so it is taken from the path, the same way the registry takes one from
 * a file that never declared a type. A source file is a component and anything
 * else is a file, which is where the CLI expects to find it.
 */
function fileTypeFor(path: string): string {
  return /\.(?:[mc]?[jt]sx?)$/i.test(path) ? "registry:component" : "registry:file";
}

/**
 * The author's files, as the document carries them.
 *
 * The column is a map of path to source, and the document is a list of files,
 * so the list is rebuilt from the map on the way out. A row written as a list
 * — which is what the documents themselves are — is read as one, because the
 * two shapes have to be understood from either side of the migration.
 */
function filesFromColumn(value: unknown): ComponentFile[] | undefined {
  if (!value || typeof value !== "object") return undefined;

  if (Array.isArray(value)) {
    const files: ComponentFile[] = [];
    for (const entry of value) {
      if (!entry || typeof entry !== "object") continue;
      const file = entry as Record<string, unknown>;
      if (typeof file.path !== "string") continue;
      const content = typeof file.content === "string" ? file.content : "";
      const type = typeof file.type === "string" ? file.type : fileTypeFor(file.path);
      files.push({ path: file.path, content, type });
    }
    return files.length ? files : undefined;
  }

  const files: ComponentFile[] = [];
  for (const [path, content] of Object.entries(value as Record<string, unknown>)) {
    files.push({
      path,
      content: typeof content === "string" ? content : "",
      type: fileTypeFor(path),
    });
  }
  return files.length ? files : undefined;
}

/**
 * The author's files, as the column carries them.
 *
 * The same map the column holds, built from the list the document carries, so
 * a file that is read back lands on the same path with the same source.
 */
function filesToColumn(value: unknown): Record<string, string> | null {
  if (value === undefined || value === null) return null;
  if (!Array.isArray(value)) {
    if (typeof value !== "object") return null;
    const map: Record<string, string> = {};
    for (const [path, content] of Object.entries(value as Record<string, unknown>)) {
      map[path] = typeof content === "string" ? content : "";
    }
    return map;
  }

  const map: Record<string, string> = {};
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const file = entry as Record<string, unknown>;
    if (typeof file.path !== "string") continue;
    map[file.path] = typeof file.content === "string" ? file.content : "";
  }
  return map;
}

/**
 * The author's assets, as the document carries them.
 *
 * A list of `{ url, type }` pairs, held in the column as a map of url to type.
 * The map cannot hold two assets that share an address, which is the one thing
 * it costs: nothing reads assets today, and an asset is an address.
 */
function assetsFromColumn(value: unknown): { url: string; type: string }[] | undefined {
  if (!value || typeof value !== "object") return undefined;

  if (Array.isArray(value)) {
    const assets: { url: string; type: string }[] = [];
    for (const entry of value) {
      if (!entry || typeof entry !== "object") continue;
      const asset = entry as Record<string, unknown>;
      if (typeof asset.url !== "string") continue;
      assets.push({ url: asset.url, type: typeof asset.type === "string" ? asset.type : "" });
    }
    return assets.length ? assets : undefined;
  }

  const assets: { url: string; type: string }[] = [];
  for (const [url, type] of Object.entries(value as Record<string, unknown>)) {
    assets.push({ url, type: typeof type === "string" ? type : "" });
  }
  return assets.length ? assets : undefined;
}

/**
 * The author's assets, as the column carries them.
 *
 * The same map the column holds, built from the list the document carries.
 */
function assetsToColumn(value: unknown): Record<string, string> | null {
  if (value === undefined || value === null) return null;
  if (!Array.isArray(value)) {
    if (typeof value !== "object") return null;
    const map: Record<string, string> = {};
    for (const [url, type] of Object.entries(value as Record<string, unknown>)) {
      map[url] = typeof type === "string" ? type : "";
    }
    return map;
  }

  const map: Record<string, string> = {};
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const asset = entry as Record<string, unknown>;
    if (typeof asset.url !== "string") continue;
    map[asset.url] = typeof asset.type === "string" ? asset.type : "";
  }
  return map;
}

/**
 * The theme variables, as the column carries them.
 *
 * The column is typed as a flat map of strings, and the document holds a map
 * of themes to maps of strings — the nesting is what the registry reads, and
 * it is what the studio parsed out of the author's stylesheet. A flat map
 * cannot hold it, so the annotation is wrong rather than the value, and the
 * cast is kept in one place with the reason written next to it.
 */
function cssVarsToColumn(value: unknown): Record<string, string> | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, string>;
}

/**
 * The author's record, as the document carries it.
 *
 * The column holds a copy of the account: the id, the name, the handle and the
 * picture. A picture that was never set is absent rather than empty, so the
 * readers that fall back to the handle's initials still do.
 */
function authorFromColumn(value: unknown): ComponentAuthor {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { userId: "", name: "", username: "" };
  }

  const record = value as Record<string, unknown>;
  const author: Record<string, unknown> = { ...record };
  if (author.avatar === null) delete author.avatar;
  return author as unknown as ComponentAuthor;
}

/**
 * One field, as the document carries it.
 *
 * A column that holds nothing is a field the document does not have: the
 * document says "optional" and a `null` in the table says the same thing. The
 * few fields the document insists on are given the value the writer would have
 * given them, so a row that somehow lost one still reads as the document it
 * was written as.
 */
function documentValue(
  field: DocumentField,
  value: unknown,
  row: Record<string, unknown>,
): unknown {
  switch (field) {
    case "files":
      return filesFromColumn(value);
    case "assets":
      return assetsFromColumn(value);
    case "author":
      return authorFromColumn(value);
    case "name":
      return value ?? row.slug;
    case "description":
      return value ?? "";
    case "version":
      return value ?? "";
    case "license":
      return value ?? "";
    default:
      return value ?? undefined;
  }
}

/**
 * A row, as a document.
 *
 * Only the fields that were selected are in the answer, which is what a
 * projection means: the card is the card's fields and nothing else.
 */
function toDocument(
  row: Record<string, unknown>,
  fields: readonly DocumentField[],
): ComponentDocument {
  const document: Record<string, unknown> = {};
  for (const field of fields) {
    document[field] = documentValue(field, row[field], row);
  }
  return document as unknown as ComponentDocument;
}

/**
 * The fields a projection asks for.
 *
 * A projection is either a list of what to keep or a list of what to leave
 * out, never both — and the id is kept unless it is the thing being left out,
 * because a document without its id cannot be addressed.
 */
function fieldsFor(projection?: Record<string, 0 | 1 | boolean>): DocumentField[] {
  if (!projection) return ALL_FIELDS;

  const entries = Object.entries(projection);
  const including = entries.some(([, value]) => value === 1 || value === true);
  const excluded = new Set(
    entries
      .filter(([, value]) => value === 0 || value === false)
      .map(([field]) => field),
  );

  if (!including) {
    return ALL_FIELDS.filter((field) => !excluded.has(field));
  }

  const wanted = new Set(
    entries
      .filter(([, value]) => value === 1 || value === true)
      .map(([field]) => field),
  );
  if (!excluded.has("_id")) wanted.add("_id");
  return ALL_FIELDS.filter((field) => wanted.has(field));
}

/** The selection a projection asks for. */
function selectionFor(fields: readonly DocumentField[]): Record<string, AnyPgColumn> {
  const selection: Record<string, AnyPgColumn> = {};
  for (const field of fields) {
    selection[field] = columnFor(field);
  }
  return selection;
}

/* -------------------------------------------------------------------------- */
/*                              The collection                                  */
/* -------------------------------------------------------------------------- */

/** Which fields a query wants back. */
export type ComponentProjection = Record<string, 0 | 1 | boolean>;

/**
 * A write, in the vocabulary the routes already speak.
 *
 * `$set` puts a value there, `$unset` takes it away and `$inc` moves a counter.
 * The three are kept apart because they are three different intentions: a
 * value that was never set and a value that was cleared are not the same
 * thing, and a flat object cannot say which one happened.
 */
export type ComponentUpdate = {
  $set?: Record<string, unknown>;
  $unset?: Record<string, string>;
  $inc?: Record<string, number>;
};

/** A query, held in one variable. */
type ComponentQuery = PromiseLike<Record<string, unknown>[]> & {
  where(condition: SQL): ComponentQuery;
  orderBy(...order: SQL[]): ComponentQuery;
  groupBy(...group: SQL[]): ComponentQuery;
  limit(count: number): ComponentQuery;
};

/**
 * A builder, loosened.
 *
 * Drizzle's builder changes its type with every clause it is given, so a query
 * that is assembled conditionally — a filter that may not be there, a sort
 * that may be empty, a limit that may not be wanted — cannot be kept in one
 * variable without loosening it first. The rows it answers with do not change
 * with the shape of the builder, so it is loosened once, here.
 */
function asQuery(builder: unknown): ComponentQuery {
  return builder as ComponentQuery;
}

/** A query that has not been run yet. */
export type ComponentCursor = {
  sort(order: Sort): ComponentCursor;
  limit(count: number): ComponentCursor;
  toArray(): Promise<ComponentDocument[]>;
};

/**
 * The components table, spoken to the way a collection was spoken to.
 *
 * This is the handle the routes were written against: they ask for a
 * collection, they filter it, they sort it, they project it, they write to it
 * with `$set` and `$unset`, and they read it back as documents. Everything
 * under it is a translation into the table, and nothing above it had to change.
 */
export type ComponentCollection = {
  /**
   * One document, by filter.
   *
   * The id it answers with is the text the row carries — the same twenty-four
   * characters the object id was made of — but the shape of the answer is the
   * one the collection always had, because a caller that asks for a document
   * with its id should not have to know which database it came from.
   */
  findOne(
    filter: Filter<ComponentDocument>,
    options?: { projection?: ComponentProjection },
  ): Promise<WithId<ComponentDocument> | null>;
  find(
    filter: Filter<ComponentDocument>,
    options?: { projection?: ComponentProjection },
  ): ComponentCursor;
  updateOne(
    filter: Filter<ComponentDocument>,
    update: ComponentUpdate,
  ): Promise<{ matchedCount: number; modifiedCount: number }>;
  updateMany(
    filter: Filter<ComponentDocument>,
    update: ComponentUpdate,
  ): Promise<{ matchedCount: number; modifiedCount: number }>;
  deleteOne(
    filter: Filter<ComponentDocument>,
  ): Promise<{ deletedCount: number }>;
  aggregate<T>(pipeline: Document[]): { toArray(): Promise<T[]> };
  createIndexes(specs: unknown[]): Promise<string[]>;
};

/**
 * A condition, read out of a filter.
 *
 * The filters that reach this module are the ones the routes wrote: an
 * equality on a column, an equality inside the author's record, and a list of
 * slugs. Anything else is left out rather than guessed at, because a filter
 * that quietly matches more than it should is how a page shows somebody else's
 * work.
 */
function conditionFor(field: string, value: unknown): SQL | undefined {
  if (value === undefined) return undefined;

  if (field === "author.username") {
    return sql`${authorField("username")} = ${String(value)}`;
  }
  if (field === "author.userId") {
    return sql`${authorField("userId")} = ${String(value)}`;
  }

  const column = COLUMN_BY_FIELD[field as DocumentField];
  if (!column) return undefined;

  if (value instanceof Date || value instanceof RegExp) {
    return sql`${column} = ${value}`;
  }

  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    const operators = value as Record<string, unknown>;
    if (Array.isArray(operators.$in)) {
      const values = operators.$in;
      if (!values.length) return sql`false`;
      return sql`${column} in (${sql.join(
        values.map((entry) => sql`${entry}`),
        sql`, `,
      )})`;
    }
    if ("$eq" in operators) return sql`${column} = ${operators.$eq}`;
    if ("$ne" in operators) return sql`${column} <> ${operators.$ne}`;
    if ("$gt" in operators) return sql`${column} > ${operators.$gt}`;
    if ("$gte" in operators) return sql`${column} >= ${operators.$gte}`;
    if ("$lt" in operators) return sql`${column} < ${operators.$lt}`;
    if ("$lte" in operators) return sql`${column} <= ${operators.$lte}`;
    return undefined;
  }

  return sql`${column} = ${value}`;
}

/** A filter, as a condition. */
function whereFor(filter: Filter<ComponentDocument> | undefined): SQL | undefined {
  if (!filter) return undefined;

  const conditions: SQL[] = [];
  for (const [field, value] of Object.entries(filter)) {
    if (field === "$and" && Array.isArray(value)) {
      for (const entry of value) {
        const condition = whereFor(entry as Filter<ComponentDocument>);
        if (condition) conditions.push(condition);
      }
      continue;
    }
    if (field === "$or" && Array.isArray(value)) {
      const branches: SQL[] = [];
      for (const entry of value) {
        const condition = whereFor(entry as Filter<ComponentDocument>);
        if (condition) branches.push(condition);
      }
      if (branches.length) {
        conditions.push(sql`(${sql.join(branches, sql` or `)})`);
      }
      continue;
    }
    if (field.startsWith("$")) continue;

    const condition = conditionFor(field, value);
    if (condition) conditions.push(condition);
  }

  if (!conditions.length) return undefined;
  if (conditions.length === 1) return conditions[0];
  return sql`(${sql.join(conditions, sql` and `)})`;
}

/** A sort, as an ordering. */
function orderFor(order: Sort): SQL[] {
  const clauses: SQL[] = [];
  for (const [field, direction] of Object.entries(order)) {
    const column = COLUMN_BY_FIELD[field as DocumentField];
    if (!column) continue;
    const descending =
      direction === -1 || direction === "desc" || direction === "descending";
    clauses.push(descending ? desc(columnFor(field as DocumentField)) : asc(columnFor(field as DocumentField)));
  }
  return clauses;
}

/**
 * A write, as a patch on the row.
 *
 * A field the table does not have is dropped rather than stored somewhere it
 * cannot be read from, and a field nobody mentioned is left alone. A value
 * that was never set is written as nothing: the document's writer meant "no
 * value here", and a row that kept the last one would be lying about it.
 */
function patchFor(update: ComponentUpdate): Record<string, unknown> {
  const patch: Record<string, unknown> = {};

  for (const [field, value] of Object.entries(update.$set ?? {})) {
    if (field === "_id") continue;
    const column = COLUMN_BY_FIELD[field as DocumentField];
    if (!column) continue;

    if (field === "files") {
      patch[field] = filesToColumn(value);
      continue;
    }
    if (field === "assets") {
      patch[field] = assetsToColumn(value);
      continue;
    }
    if (field === "cssVars") {
      patch[field] = cssVarsToColumn(value);
      continue;
    }
    patch[field] = value === undefined ? null : value;
  }

  for (const field of Object.keys(update.$unset ?? {})) {
    if (field === "_id") continue;
    const column = COLUMN_BY_FIELD[field as DocumentField];
    if (!column) continue;
    patch[field] = null;
  }

  for (const [field, amount] of Object.entries(update.$inc ?? {})) {
    if (field === "_id") continue;
    const column = COLUMN_BY_FIELD[field as DocumentField];
    if (!column) continue;
    patch[field] = sql`${column} + ${amount}`;
  }

  return patch;
}

/**
 * The collection, pointed at the table.
 *
 * The call to `db()` is not decoration. A missing `DATABASE_URL` has to throw
 * from here, the way a missing `MONGODB_URI` threw from the Mongo connection,
 * because the callers catch that error and answer with a degraded response
 * rather than a crash.
 */
export async function getComponentsCollection(): Promise<ComponentCollection> {
  const client = db();

  const read = async (
    filter: Filter<ComponentDocument>,
    projection?: ComponentProjection,
  ): Promise<ComponentDocument[]> => {
    const fields = fieldsFor(projection);
    const selection = selectionFor(fields);
    const where = whereFor(filter);

    const rows = await asQuery(client.select(selection).from(components)).where(
      where ?? sql`true`,
    );

    return rows.map((row) => toDocument(row, fields));
  };

  const write = async (
    filter: Filter<ComponentDocument>,
    update: ComponentUpdate,
  ): Promise<{ matchedCount: number; modifiedCount: number }> => {
    const where = whereFor(filter);
    const patch = patchFor(update);
    if (!Object.keys(patch).length) {
      const counted = where
        ? await client.select({ id: components.id }).from(components).where(where)
        : await client.select({ id: components.id }).from(components);
      return { matchedCount: counted.length, modifiedCount: 0 };
    }

    const query = client.update(components).set(
      patch as PgUpdateSetSource<typeof components>,
    );
    const result = where ? await query.where(where) : await query;

    const count = result.rowCount ?? 0;
    return { matchedCount: count, modifiedCount: count };
  };

  return {
    async findOne(filter, options) {
      const rows = await read(filter, options?.projection);
      return (rows[0] ?? null) as WithId<ComponentDocument> | null;
    },

    find(filter, options) {
      const fields = fieldsFor(options?.projection);
      const selection = selectionFor(fields);
      let order: SQL[] = [];
      let max: number | undefined;

      return {
        sort(spec) {
          order = orderFor(spec);
          return this;
        },
        limit(count) {
          max = count;
          return this;
        },
        async toArray() {
          const where = whereFor(filter);
          /**
           * A query with no sort of its own comes back in the order the rows
           * were written, which is what the collection did: the natural order
           * of a collection is the order of its ids.
           */
          const clauses = order.length ? order : [asc(columnFor("_id"))];
          let query = asQuery(client.select(selection).from(components)).where(
            where ?? sql`true`,
          );
          query = query.orderBy(...clauses);
          if (max !== undefined) query = query.limit(max);

          const rows = await query;
          return rows.map((row) => toDocument(row, fields));
        },
      };
    },

    async updateOne(filter, update) {
      return write(filter, update);
    },

    async updateMany(filter, update) {
      return write(filter, update);
    },

    async deleteOne(filter) {
      const where = whereFor(filter);
      const query = client.delete(components);
      const deleted = where ? await query.where(where).returning({ id: components.id }) : await query.returning({ id: components.id });
      return { deletedCount: deleted.length };
    },

    aggregate<T>(pipeline: Document[]) {
      return { toArray: () => runAggregation<T>(pipeline) };
    },

    async createIndexes() {
      return [];
    },
  };
}

/* -------------------------------------------------------------------------- */
/*                                  Indexes                                    */
/* -------------------------------------------------------------------------- */

/**
 * Whether the component indexes have been built in this process.
 *
 * Nothing builds them here any more. The indexes are in the schema, and they
 * are in the database: a unique index on the slug, one on the author's
 * handle, and one over the feed's own filter. The Mongo version created them
 * at runtime because a stray write could bring a collection into existence
 * with no index on it; a table either exists with its constraints or it does
 * not exist at all.
 */
let indexesReady = false;

/**
 * Nothing to do.
 *
 * The function kept its name because a dozen modules call it and because the
 * guard it used to hold — created once per process, on first use — is still
 * the shape of the answer: the indexes are there, so there is nothing left to
 * do at runtime, and a request never pays for a migration.
 */
export async function ensureComponentIndexes(): Promise<void> {
  if (indexesReady) return;
  indexesReady = true;
}

/** Reset the in-process guard. For tests that rebuild the table. */
export function resetComponentIndexes(): void {
  indexesReady = false;
}

/* -------------------------------------------------------------------------- */
/*                                 Listings                                    */
/* -------------------------------------------------------------------------- */

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
 * The value a cursor holds for one sort field.
 *
 * A timestamp travels as an ISO string, and a string is not a timestamp: the
 * comparison that follows would be between two different kinds of thing, and
 * it would match nothing. So the string is read back as the date it was.
 */
function cursorValue(field: string, cursor: Record<string, unknown>): unknown {
  const value = cursor[field];
  if (value === undefined || value === null) return undefined;

  if (field === "createdAt" || field === "updatedAt" || field === "publishedAt") {
    const date = new Date(String(value));
    return Number.isNaN(date.getTime()) ? undefined : date;
  }
  return value;
}

/**
 * The clause that seeks past a cursor.
 *
 * A cursor names a position in the ordering, and the rows after it are the
 * ones that sort below it. Each field is compared against the cursor's value
 * for that field, and the fields before it have to be *equal* for the
 * comparison to mean anything — which is why the clause is a chain of
 * alternatives rather than a list of conditions. The tiebreaker is in the
 * chain, so two rows with the same counters are still ordered and a page
 * boundary cannot drop one or show it twice.
 */
function seekFor(
  fields: { field: string; direction: 1 | -1 }[],
  cursor: Record<string, unknown>,
): SQL | undefined {
  const branches: SQL[] = [];

  for (let index = 0; index < fields.length; index += 1) {
    const equalities: SQL[] = [];
    for (let before = 0; before < index; before += 1) {
      const earlier = fields[before];
      const value = cursorValue(earlier.field, cursor);
      if (value === undefined) return undefined;
      equalities.push(sql`${COLUMN_BY_FIELD[earlier.field as DocumentField]} = ${value}`);
    }

    const current = fields[index];
    const value = cursorValue(current.field, cursor);
    if (value === undefined) return undefined;

    const column = COLUMN_BY_FIELD[current.field as DocumentField];
    const comparison =
      current.direction === -1
        ? sql`${column} < ${value}`
        : sql`${column} > ${value}`;

    branches.push(
      equalities.length
        ? sql`(${sql.join(equalities, sql` and `)}) and ${comparison}`
        : comparison,
    );
  }

  if (!branches.length) return undefined;
  return sql`(${sql.join(branches, sql` or `)})`;
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
  const client = db();
  const limit = Math.min(
    Math.max(options.limit ?? DEFAULT_LIMIT, 1),
    MAX_PAGE_SIZE
  );

  const conditions: SQL[] = [
    sql`${components.status} = ${options.status ?? "published"}`,
    sql`${components.visibility} = 'public'`,
  ];

  if (options.tag) {
    // The tag is one of the names in the array, not the array itself.
    conditions.push(
      sql`${components.tags} @> ${JSON.stringify([options.tag])}::jsonb`,
    );
  }
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
    conditions.push(
      sql`${components.category} in (${sql.join(
        storedCategoriesFor(options.category).map((value) => sql`${value}`),
        sql`, `,
      )})`,
    );
  }
  if (options.author) {
    conditions.push(sql`${authorField("username")} = ${options.author}`);
  }

  if (options.q && options.q.trim()) {
    const query = options.q.trim();
    /**
     * The same four fields the search has always covered, matched the same
     * way: the query is a pattern, and the pattern is not anchored, so a word
     * in the middle of a description is found as readily as one at the start.
     */
    const search = or(
      sql`${components.title} ~* ${query}`,
      sql`${components.description} ~* ${query}`,
      sql`${components.tags}::text ~* ${query}`,
      sql`${components.name} ~* ${query}`,
    );
    if (search) conditions.push(search);
  }

  const { sort, tiebreaker } = sortSpecFor(options.sort);
  const ordered: { field: string; direction: 1 | -1 }[] = [
    ...Object.entries(sort).map(([field, direction]) => ({
      field,
      direction: direction as 1 | -1,
    })),
    { field: "_id", direction: tiebreaker },
  ];

  if (options.cursor) {
    const cursor = decodeCursor<Record<string, unknown>>(options.cursor);
    if (cursor) {
      const seek = seekFor(ordered, cursor);
      if (seek) conditions.push(seek);
    }
  }

  const fields = fieldsFor(CARD_FIELDS);
  const rows = await client
    .select(selectionFor(fields))
    .from(components)
    .where(and(...conditions))
    .orderBy(...ordered.map((entry) => {
      const column = COLUMN_BY_FIELD[entry.field as DocumentField];
      return entry.direction === -1 ? desc(column) : asc(column);
    }))
    .limit(limit + 1);

  const items = (rows.length > limit ? rows.slice(0, limit) : rows).map((row) =>
    toDocument(row as Record<string, unknown>, fields),
  ) as ComponentCardDocument[];

  const hasMore = rows.length > limit;

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
  const client = db();
  const rows = await client
    .select(selectionFor(ALL_FIELDS))
    .from(components)
    .where(
      and(
        eq(components.slug, slug),
        eq(components.status, "published"),
      ),
    )
    .limit(1);

  const row = rows[0];
  return row ? toDocument(row as Record<string, unknown>, ALL_FIELDS) : null;
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
  const client = db();
  const fields = fieldsFor(options.projection);
  const rows = await client
    .select(selectionFor(fields))
    .from(components)
    .where(eq(components.slug, slug))
    .limit(1);

  const row = rows[0];
  return row ? toDocument(row as Record<string, unknown>, fields) : null;
}

/** Everything one author owns, drafts first, newest first. */
export async function listUserComponents(
  userId: string,
  limit = 60
): Promise<ComponentCardDocument[]> {
  const client = db();
  const fields = fieldsFor(CARD_FIELDS);
  const rows = await client
    .select(selectionFor(fields))
    .from(components)
    .where(sql`${authorField("userId")} = ${userId}`)
    .orderBy(asc(components.status), desc(components.updatedAt))
    .limit(Math.min(Math.max(limit, 1), 200));

  return rows.map(
    (row) => toDocument(row as Record<string, unknown>, fields),
  ) as ComponentCardDocument[];
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
 *
 * Only the picture is written. The rest of the record — the id, the name, the
 * handle, and anything else the account carries — is left exactly as it was,
 * because a copy that is refreshed wholesale is a copy that can lose a field
 * the account has not caught up with yet.
 */
export async function syncAuthorAvatar(
  userId: string,
  avatar?: string | null,
): Promise<void> {
  const client = db();
  await client
    .update(components)
    .set({
      author: sql`jsonb_set(${components.author}, '{avatar}', to_jsonb(${avatar ?? ""}::text))`,
    })
    .where(sql`${authorField("userId")} = ${userId}`);
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

  const client = db();
  const fields = fieldsFor(CARD_FIELDS);
  const rows = await client
    .select(selectionFor(fields))
    .from(components)
    .where(
      and(
        inArray(components.slug, wanted),
        eq(components.status, "published"),
        eq(components.visibility, "public"),
      ),
    );

  const bySlug = new Map(
    rows.map((row) => {
      const document = toDocument(row as Record<string, unknown>, fields);
      return [document.slug, document] as const;
    }),
  );

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
  const rows = await runAggregation<AuthorStats & { _id: unknown }>(
    authorStatsPipeline(handle),
  );

  // A `$group` over zero documents emits no row at all, so an author who has
  // not published is the empty set rather than a row of nulls.
  const row = rows[0];
  if (!row) return EMPTY_AUTHOR_STATS;

  return {
    components: row.components ?? 0,
    views: row.views ?? 0,
    likes: row.likes ?? 0,
    installs: row.installs ?? 0,
  };
}

/**
 * An aggregation, run against the table.
 *
 * The pipeline is the one the module has always written, and it is run here
 * rather than re-spelled as SQL, so that the two cannot drift: the filter that
 * decides which rows belong to an author is written once, and the numbers the
 * profile shows are the numbers that filter produced.
 *
 * The stages it understands are the ones the app uses — a match, a group that
 * counts or sums, a sort and a limit — and anything else is refused rather
 * than quietly answered with something else.
 */
async function runAggregation<T>(pipeline: Document[]): Promise<T[]> {
  let match: Record<string, unknown> | undefined;
  let group: Record<string, unknown> | undefined;
  let sort: Record<string, unknown> | undefined;
  let limit: number | undefined;

  for (const stage of pipeline) {
    if (!stage || typeof stage !== "object") continue;
    if ("$match" in stage) {
      match = stage.$match as Record<string, unknown>;
    } else if ("$group" in stage) {
      group = stage.$group as Record<string, unknown>;
    } else if ("$sort" in stage) {
      sort = stage.$sort as Record<string, unknown>;
    } else if ("$limit" in stage) {
      limit = Number(stage.$limit);
    } else {
      throw new Error(
        `unsupported aggregation stage: ${Object.keys(stage).join(", ")}`,
      );
    }
  }

  if (!group) {
    throw new Error("this aggregation needs a $group stage");
  }

  const selection: Record<string, SQL> = {};
  let grouped: SQL | undefined;

  const key = group._id;
  if (key === null || key === undefined) {
    selection._id = sql<null>`null`;
  } else if (typeof key === "string" && key.startsWith("$")) {
    const expression = expressionFor(key.slice(1));
    selection._id = expression;
    grouped = expression;
  } else {
    throw new Error("unsupported group key");
  }

  for (const [name, accumulator] of Object.entries(group)) {
    if (name === "_id") continue;
    selection[name] = sumFor(accumulator, name);
  }

  const client = db();
  let query = asQuery(client.select(selection).from(components));

  const where = whereFor(match as Filter<ComponentDocument> | undefined);
  query = query.where(where ?? sql`true`);
  if (grouped) query = query.groupBy(grouped);

  if (sort) {
    const clauses: SQL[] = [];
    for (const [field, direction] of Object.entries(sort)) {
      const descending = direction === -1 || direction === "descending" || direction === "desc";
      if (field in selection) {
        clauses.push(
          descending
            ? sql`${sql.identifier(field)} desc`
            : sql`${sql.identifier(field)} asc`,
        );
        continue;
      }
      const column = COLUMN_BY_FIELD[field as DocumentField];
      if (!column) continue;
      clauses.push(descending ? desc(columnFor(field as DocumentField)) : asc(columnFor(field as DocumentField)));
    }
    if (clauses.length) query = query.orderBy(...clauses);
  }

  if (limit !== undefined) query = query.limit(limit);

  const rows = await query;
  return rows as unknown as T[];
}

/**
 * A field, as an expression that can be grouped by.
 *
 * The two fields inside the author's record are read with `->>`, so a group by
 * the handle groups by the handle and not by the whole record.
 */
function expressionFor(path: string): SQL {
  if (path === "author.username") return authorField("username");
  if (path === "author.userId") return authorField("userId");
  const column = COLUMN_BY_FIELD[path as DocumentField];
  if (!column) {
    throw new Error(`unknown field in aggregation: ${path}`);
  }
  return sql`${column}`;
}

/**
 * A sum, as an expression.
 *
 * `$sum: 1` counts the rows and `$sum: "$views"` adds the counter up. A
 * counter that is missing counts as zero rather than as nothing, which is what
 * `$ifNull` is for — the oldest records predate the counters, and without it
 * their author would lose a decade of views instead of counting them as zero.
 */
function sumFor(accumulator: unknown, name: string): SQL {
  if (!accumulator || typeof accumulator !== "object") {
    throw new Error(`unsupported accumulator for ${name}`);
  }

  const sum = (accumulator as { $sum?: unknown }).$sum;
  if (sum === 1) return sql<number>`count(*)::int`;

  if (typeof sum === "string" && sum.startsWith("$")) {
    const column = expressionFor(sum.slice(1));
    return sql<number>`coalesce(sum(${column}), 0)::int`;
  }

  if (sum && typeof sum === "object" && "$ifNull" in sum) {
    const inner = (sum as { $ifNull?: unknown[] }).$ifNull;
    const path = Array.isArray(inner) ? inner[0] : undefined;
    if (typeof path === "string" && path.startsWith("$")) {
      const column = expressionFor(path.slice(1));
      return sql<number>`coalesce(sum(${column}), 0)::int`;
    }
  }

  throw new Error(`unsupported accumulator for ${name}`);
}

/* -------------------------------------------------------------------------- */
/*                                  Writing                                    */
/* -------------------------------------------------------------------------- */

/**
 * A fresh id for a component.
 *
 * Twenty-four hex characters, the shape the ids already in the table have, so
 * a new row is not the only one in the database that looks different.
 */
function newId(): string {
  return randomBytes(12).toString("hex");
}

export async function createComponent(input: ComponentInput): Promise<ComponentDocument> {
  const client = db();
  const now = new Date();

  const baseSlug = input.slug ? slugify(input.slug) : slugify(input.title || input.name);
  if (!isValidSlug(baseSlug)) {
    throw new Error("Invalid component slug");
  }

  const existing = await client
    .select({ id: components.id })
    .from(components)
    .where(eq(components.slug, baseSlug))
    .limit(1);

  const slug = existing.length ? `${baseSlug}-${Date.now().toString(36)}` : baseSlug;

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

  const id = newId();

  await client.insert(components).values({
    id,
    slug: doc.slug,
    name: doc.name,
    title: doc.title,
    description: doc.description,
    code: doc.code,
    componentPath: doc.componentPath ?? null,
    demoCode: doc.demoCode ?? null,
    styleCode: doc.styleCode ?? null,
    thumbnailUrl: doc.thumbnailUrl ?? null,
    videoUrl: doc.videoUrl ?? null,
    assets: assetsToColumn(doc.assets),
    files: filesToColumn(doc.files),
    category: doc.category,
    tags: doc.tags,
    dependencies: doc.dependencies,
    devDependencies: doc.devDependencies,
    registryDependencies: doc.registryDependencies,
    cssVars: cssVarsToColumn(doc.cssVars),
    author: doc.author,
    visibility: doc.visibility,
    status: doc.status,
    installs: doc.installs,
    views: doc.views,
    likes: doc.likes,
    featured: doc.featured,
    version: doc.version,
    parentSlug: doc.parentSlug ?? null,
    license: doc.license,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    publishedAt: doc.publishedAt ?? null,
  });

  return { ...doc, _id: id };
}

export async function incrementComponentMetric(
  slug: string,
  metric: "views" | "installs" | "likes"
) {
  const client = db();
  const column = COLUMN_BY_FIELD[metric];
  await client
    .update(components)
    .set({
      [metric]: sql`${column} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(components.slug, slug));
}
