import { connectToDatabase } from "@/lib/mongodb";
import { ObjectId, type Sort } from "mongodb";

export type ComponentVisibility = "public" | "unlisted" | "private";
export type ComponentStatus = "draft" | "published" | "hidden" | "flagged";

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
  demoCode?: string;
  previewHtml?: string;
  previewHash?: string;
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

export async function getComponentsCollection() {
  const { db } = await connectToDatabase();
  return db.collection<ComponentDocument>("components");
}

export async function ensureComponentIndexes() {
  const collection = await getComponentsCollection();
  await collection.createIndexes([
    { key: { slug: 1 }, unique: true },
    { key: { name: 1 } },
    { key: { "author.username": 1 } },
    { key: { status: 1, visibility: 1, createdAt: -1 } },
    { key: { tags: 1 } },
    { key: { title: "text", description: "text", tags: "text" } },
  ]);
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

export async function listComponents(options: ListComponentsOptions = {}) {
  const collection = await getComponentsCollection();
  const limit = Math.min(Math.max(options.limit ?? DEFAULT_LIMIT, 1), 60);

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

  const sort: Sort =
    options.sort === "popular"
      ? { likes: -1, views: -1, createdAt: -1 }
      : options.sort === "installs"
        ? { installs: -1, createdAt: -1 }
        : options.sort === "trending"
          ? { views: -1, installs: -1, createdAt: -1 }
          : { createdAt: -1 };

  return collection
    .find(filter)
    .sort(sort)
    .limit(limit)
    .toArray();
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
    demoCode: input.demoCode,
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
