import { connectToDatabase } from "@/lib/mongodb";
import { Collection, ObjectId, type WithId } from "mongodb";
import { getComponentsCollection, type ComponentDocument } from "@/lib/db/components";

/* -------------------------------------------------------------------------- */
/*                                    Types                                    */
/* -------------------------------------------------------------------------- */

export type BundlePlanType = "individual" | "team" | "enterprise";
export type PaymentStatus = "pending" | "paid" | "rejected" | "refunded";

export const BUNDLE_PLAN_TYPES: BundlePlanType[] = ["individual", "team", "enterprise"];

/** Author attribution, shaped like `ComponentAuthor` so cards can share it. */
export type BundleAuthor = {
  userId: string;
  name: string;
  username: string;
  avatar?: string;
};

export type BundleDocument = {
  _id?: ObjectId;
  /** URL segment: /bundles/<slug> and /r/bundle/<slug>. */
  slug: string;
  name: string;
  description: string;
  coverImageUrl?: string;
  /** Component slugs, in curated display order. */
  componentSlugs: string[];
  author: BundleAuthor;
  /**
   * Mirrors 21st's `bundles.is_public`. Private bundles are only visible to
   * their author, which is how drafts stay out of the public feed.
   */
  isPublic: boolean;
  featured: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type BundlePlanDocument = {
  _id?: ObjectId;
  bundleSlug: string;
  type: BundlePlanType;
  description: string;
  /** Price in cents. `0` means the bundle is free to install. */
  price: number;
  features: string[];
  createdAt: Date;
};

export type BundlePurchaseDocument = {
  _id?: ObjectId;
  userId: string;
  bundleSlug: string;
  planType?: BundlePlanType;
  /** Price in cents, snapshotted at purchase time. */
  price: number;
  status: PaymentStatus;
  createdAt: Date;
};

/* -------------------------------------------------------------------------- */
/*                              Collections                                   */
/* -------------------------------------------------------------------------- */

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function slugifyBundleName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function isValidBundleSlug(slug: string): boolean {
  return SLUG_RE.test(slug) && slug.length > 2 && slug.length < 90;
}

export async function getBundlesCollection(): Promise<Collection<BundleDocument>> {
  const { db } = await connectToDatabase();
  const collection = db.collection<BundleDocument>("bundles");
  await collection.createIndexes([
    { key: { slug: 1 }, unique: true },
    { key: { "author.username": 1, createdAt: -1 } },
    { key: { isPublic: 1, createdAt: -1 } },
    { key: { featured: 1, createdAt: -1 } },
  ]);
  return collection;
}

export async function getBundlePlansCollection(): Promise<Collection<BundlePlanDocument>> {
  const { db } = await connectToDatabase();
  const collection = db.collection<BundlePlanDocument>("bundle_plans");
  await collection.createIndexes([
    { key: { bundleSlug: 1, type: 1 }, unique: true },
  ]);
  return collection;
}

export async function getBundlePurchasesCollection(): Promise<Collection<BundlePurchaseDocument>> {
  const { db } = await connectToDatabase();
  const collection = db.collection<BundlePurchaseDocument>("bundle_purchases");
  await collection.createIndexes([
    // One purchase row per (user, bundle); purchases are updated in place.
    { key: { userId: 1, bundleSlug: 1 }, unique: true },
    { key: { userId: 1, createdAt: -1 } },
  ]);
  return collection;
}

/* -------------------------------------------------------------------------- */
/*                                   Reads                                    */
/* -------------------------------------------------------------------------- */

export type ListBundlesOptions = {
  q?: string;
  /** Filter to one author by username. */
  author?: string;
  /**
   * When true the author's private bundles are included alongside their
   * public ones. Mirrors 21st's `getBundles` OR-filter.
   */
  includePrivate?: boolean;
  limit?: number;
};

const DEFAULT_BUNDLE_LIMIT = 12;

/**
 * Lists bundles newest-first, attaching plans and the viewer's own purchase
 * so the UI can render prices and status badges in a single round trip.
 *
 * `viewerId` scopes purchases to the caller — we never leak who else bought.
 */
export async function listBundles(options: ListBundlesOptions = {}, viewerId?: string) {
  const collection = await getBundlesCollection();
  const limit = Math.min(Math.max(options.limit ?? DEFAULT_BUNDLE_LIMIT, 1), 60);

  const filter: Record<string, unknown> = {};
  const or: Record<string, unknown>[] = [{ isPublic: true }];

  if (options.author) {
    filter["author.username"] = options.author;
    // The username filter narrows this, so widening to private bundles here
    // still only ever returns the named author's own drafts.
    if (options.includePrivate) or.push({ isPublic: false });
  }
  filter.$or = or;

  if (options.q?.trim()) {
    const query = options.q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.name = { $regex: query, $options: "i" };
  }

  const bundles = await collection
    .find(filter)
    .sort({ featured: -1, createdAt: -1 })
    .limit(limit)
    .toArray();

  if (!bundles.length) return [];

  const plans = await getBundlePlansCollection();
  const purchases = viewerId ? await getBundlePurchasesCollection() : null;

  const plansByBundle = await plans
    .find({ bundleSlug: { $in: bundles.map((b) => b.slug) } })
    .toArray();
  const purchasesByBundle = purchases
    ? await purchases
        .find({ userId: viewerId!, bundleSlug: { $in: bundles.map((b) => b.slug) } })
        .sort({ createdAt: -1 })
        .toArray()
    : [];

  return bundles.map((bundle) =>
    withRelations(
      bundle,
      plansByBundle.filter((p) => p.bundleSlug === bundle.slug),
      purchasesByBundle.filter((p) => p.bundleSlug === bundle.slug)
    )
  );
}

export type BundleWithRelations = BundleDocument & {
  plans: BundlePlanDocument[];
  /** The viewer's most recent purchase for this bundle, if any. */
  purchase: BundlePurchaseDocument | null;
};

function withRelations(
  bundle: BundleDocument,
  plans: BundlePlanDocument[],
  purchases: BundlePurchaseDocument[]
): BundleWithRelations {
  const sortedPlans = [...plans].sort(
    (a, b) => BUNDLE_PLAN_TYPES.indexOf(a.type) - BUNDLE_PLAN_TYPES.indexOf(b.type)
  );
  const latest = [...purchases].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  )[0];

  return { ...bundle, plans: sortedPlans, purchase: latest ?? null };
}

export async function getBundleBySlug(
  slug: string,
  viewerId?: string
): Promise<BundleWithRelations | null> {
  const collection = await getBundlesCollection();
  const bundle = await collection.findOne({ slug });
  if (!bundle) return null;

  const plansCollection = await getBundlePlansCollection();
  const plans = await plansCollection.find({ bundleSlug: slug }).toArray();

  let purchase: BundlePurchaseDocument | null = null;
  if (viewerId) {
    const purchases = await getBundlePurchasesCollection();
    const rows = await purchases
      .find({ userId: viewerId, bundleSlug: slug })
      .sort({ createdAt: -1 })
      .limit(1)
      .toArray();
    purchase = rows[0] ?? null;
  }

  return withRelations(bundle, plans, purchase ? [purchase] : []);
}

/**
 * Resolves a bundle's components for display. Unpublished components are
 * dropped so a bundle never leaks a draft the author has since hidden.
 */
export async function getBundleComponents(
  componentSlugs: string[]
): Promise<WithId<ComponentDocument>[]> {
  if (!componentSlugs.length) return [];
  const collection = await getComponentsCollection();
  const docs = await collection
    .find({ slug: { $in: componentSlugs }, status: "published", visibility: "public" })
    .toArray();

  // Preserve the curator's ordering rather than Mongo's natural order.
  const bySlug = new Map(docs.map((doc) => [doc.slug, doc]));
  const ordered: (WithId<ComponentDocument> | undefined)[] = componentSlugs.map((slug) =>
    bySlug.get(slug)
  );
  return ordered.filter((doc): doc is WithId<ComponentDocument> => doc !== undefined);
}

/* -------------------------------------------------------------------------- */
/*                                  Writes                                    */
/* -------------------------------------------------------------------------- */

export async function createBundle(input: {
  name: string;
  description?: string;
  author: BundleAuthor;
  componentSlugs?: string[];
  coverImageUrl?: string;
  isPublic?: boolean;
}): Promise<BundleDocument> {
  const collection = await getBundlesCollection();
  const baseSlug = slugifyBundleName(input.name);
  if (!isValidBundleSlug(baseSlug)) {
    throw new Error("Bundle name must contain at least three letters or numbers");
  }

  const existing = await collection.findOne({ slug: baseSlug });
  const slug = existing ? `${baseSlug}-${Date.now().toString(36)}` : baseSlug;
  const now = new Date();

  const doc: BundleDocument = {
    slug,
    name: input.name.trim(),
    description: input.description?.trim() ?? "",
    coverImageUrl: input.coverImageUrl,
    componentSlugs: input.componentSlugs ?? [],
    author: input.author,
    isPublic: input.isPublic ?? false,
    featured: false,
    createdAt: now,
    updatedAt: now,
  };

  await collection.insertOne(doc);
  return doc;
}

export async function updateBundle(
  slug: string,
  patch: Partial<
    Pick<
      BundleDocument,
      "name" | "description" | "coverImageUrl" | "componentSlugs" | "isPublic" | "featured"
    >
  >
): Promise<BundleDocument | null> {
  const collection = await getBundlesCollection();
  const current = await collection.findOne({ slug });
  if (!current) return null;

  const update: Record<string, unknown> = { ...patch, updatedAt: new Date() };

  // A rename moves the public URL, so re-slug only when the name actually
  // changed, and never onto a slug another bundle already owns.
  if (patch.name && patch.name.trim() !== current.name) {
    const baseSlug = slugifyBundleName(patch.name);
    if (isValidBundleSlug(baseSlug)) {
      const taken = await collection.findOne({ slug: baseSlug, _id: { $ne: current._id } });
      update.slug = taken ? `${baseSlug}-${Date.now().toString(36)}` : baseSlug;
    }
  }

  await collection.updateOne({ slug }, { $set: update });
  return collection.findOne({ slug: (update.slug as string) ?? slug });
}

export async function deleteBundle(slug: string): Promise<boolean> {
  const collection = await getBundlesCollection();
  const plans = await getBundlePlansCollection();
  const purchases = await getBundlePurchasesCollection();

  const result = await collection.deleteOne({ slug });
  // Mirror the ON DELETE CASCADE behaviour of 21st's bundle_items.
  await Promise.all([
    plans.deleteMany({ bundleSlug: slug }),
    purchases.deleteMany({ bundleSlug: slug }),
  ]);

  return result.deletedCount > 0;
}

/* -------------------------------------------------------------------------- */
/*                                   Items                                    */
/* -------------------------------------------------------------------------- */

/** Appends a component, ignoring duplicates the way a join table would. */
export async function addComponentToBundle(
  slug: string,
  componentSlug: string
): Promise<string[] | null> {
  const collection = await getBundlesCollection();
  const bundle = await collection.findOne({ slug });
  if (!bundle) return null;

  if (bundle.componentSlugs.includes(componentSlug)) {
    return bundle.componentSlugs;
  }

  const next = [...bundle.componentSlugs, componentSlug];
  await collection.updateOne(
    { slug },
    { $set: { componentSlugs: next, updatedAt: new Date() } }
  );
  return next;
}

export async function removeComponentFromBundle(
  slug: string,
  componentSlug: string
): Promise<string[] | null> {
  const collection = await getBundlesCollection();
  const bundle = await collection.findOne({ slug });
  if (!bundle) return null;

  const next = bundle.componentSlugs.filter((item) => item !== componentSlug);
  await collection.updateOne(
    { slug },
    { $set: { componentSlugs: next, updatedAt: new Date() } }
  );
  return next;
}

/* -------------------------------------------------------------------------- */
/*                                   Plans                                    */
/* -------------------------------------------------------------------------- */

export async function listBundlePlans(bundleSlug: string): Promise<BundlePlanDocument[]> {
  const collection = await getBundlePlansCollection();
  const plans = await collection.find({ bundleSlug }).toArray();
  return plans.sort(
    (a, b) => BUNDLE_PLAN_TYPES.indexOf(a.type) - BUNDLE_PLAN_TYPES.indexOf(b.type)
  );
}

export async function upsertBundlePlan(input: {
  bundleSlug: string;
  type: BundlePlanType;
  description: string;
  price: number;
  features?: string[];
}): Promise<BundlePlanDocument> {
  const collection = await getBundlePlansCollection();
  const doc: BundlePlanDocument = {
    bundleSlug: input.bundleSlug,
    type: input.type,
    description: input.description.trim(),
    price: Math.max(0, Math.round(input.price)),
    features: input.features ?? [],
    createdAt: new Date(),
  };

  await collection.updateOne(
    { bundleSlug: input.bundleSlug, type: input.type },
    { $set: { description: doc.description, price: doc.price, features: doc.features } },
    { upsert: true }
  );

  return (await collection.findOne({ bundleSlug: input.bundleSlug, type: input.type })) ?? doc;
}

export async function deleteBundlePlan(bundleSlug: string, type: BundlePlanType) {
  const collection = await getBundlePlansCollection();
  const result = await collection.deleteOne({ bundleSlug, type });
  return result.deletedCount > 0;
}

/* -------------------------------------------------------------------------- */
/*                                Purchases                                   */
/* -------------------------------------------------------------------------- */

/**
 * Whether a viewer may read the source of a bundle's components.
 *
 * The author always can, a viewer with a `paid` purchase can, and free
 * bundles (no priced plans) are open to everyone.
 */
export function hasBundleAccess(
  bundle: Pick<BundleDocument, "author">,
  plans: BundlePlanDocument[],
  purchase: BundlePurchaseDocument | null,
  viewerId?: string
): boolean {
  if (viewerId && bundle.author.userId === viewerId) return true;
  if (purchase?.status === "paid") return true;
  return isBundleFree(plans);
}

/** A bundle is free when it has no priced plans at all. */
export function isBundleFree(plans: { price: number }[]): boolean {
  return plans.every((plan) => plan.price <= 0);
}

/**
 * Grants access to a free bundle. Paid bundles are rejected here on purpose:
 * they need a payment provider to confirm the charge, so callers must route
 * them through checkout rather than trusting the client.
 */
export async function claimFreeBundle(
  bundleSlug: string,
  userId: string
): Promise<BundlePurchaseDocument> {
  const collection = await getBundlePurchasesCollection();
  await collection.updateOne(
    { userId, bundleSlug },
    {
      $set: { status: "paid" as PaymentStatus, price: 0 },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true }
  );

  const row = await collection.findOne({ userId, bundleSlug });
  return row ?? { userId, bundleSlug, price: 0, status: "paid", createdAt: new Date() };
}

/** "Owned" in 21st means purchased — used by the library view. */
export async function listPurchasedBundleSlugs(userId: string): Promise<string[]> {
  const collection = await getBundlePurchasesCollection();
  const rows = await collection
    .find({ userId, status: "paid" })
    .sort({ createdAt: -1 })
    .toArray();
  return rows.map((row) => row.bundleSlug);
}
