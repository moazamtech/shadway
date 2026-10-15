import { connectToDatabase } from "@/lib/mongodb";
import { ObjectId, type Collection } from "mongodb";

/* -------------------------------------------------------------------------- */
/*                              Bookmarks                                    */
/* -------------------------------------------------------------------------- */

export type BookmarkDocument = {
  _id?: ObjectId;
  userId: string;
  slug: string;
  createdAt: Date;
};

export async function getBookmarksCollection(): Promise<Collection<BookmarkDocument>> {
  const { db } = await connectToDatabase();
  const collection = db.collection<BookmarkDocument>("component_bookmarks");
  await collection.createIndexes([
    { key: { userId: 1, slug: 1 }, unique: true },
    { key: { userId: 1, createdAt: -1 } },
  ]);
  return collection;
}

export async function ensureBookmarked(userId: string, slug: string): Promise<boolean> {
  const collection = await getBookmarksCollection();
  const result = await collection.updateOne(
    { userId, slug },
    { $setOnInsert: { userId, slug, createdAt: new Date() } },
    { upsert: true }
  );

  if (result.upsertedCount > 0) {
    const { db } = await connectToDatabase();
    await db
      .collection("components")
      .updateOne({ slug }, { $inc: { bookmarks: 1 } });
  }

  return result.upsertedCount > 0;
}

export async function removeBookmark(userId: string, slug: string): Promise<boolean> {
  const collection = await getBookmarksCollection();
  const result = await collection.deleteOne({ userId, slug });

  if (result.deletedCount > 0) {
    const { db } = await connectToDatabase();
    await db
      .collection("components")
      .updateOne({ slug, bookmarks: { $gt: 0 } }, { $inc: { bookmarks: -1 } });
  }

  return result.deletedCount > 0;
}

export async function getUserBookmarks(userId: string): Promise<string[]> {
  const collection = await getBookmarksCollection();
  const rows = await collection.find({ userId }).sort({ createdAt: -1 }).toArray();
  return rows.map((row) => row.slug);
}

export async function countBookmarks(slug: string): Promise<number> {
  const collection = await getBookmarksCollection();
  return collection.countDocuments({ slug });
}

/* -------------------------------------------------------------------------- */
/*                                 Votes                                      */
/* -------------------------------------------------------------------------- */

export type VoteDocument = {
  _id?: ObjectId;
  userId: string;
  slug: string;
  createdAt: Date;
};

export async function getVotesCollection(): Promise<Collection<VoteDocument>> {
  const { db } = await connectToDatabase();
  const collection = db.collection<VoteDocument>("component_votes");
  await collection.createIndexes([
    { key: { userId: 1, slug: 1 }, unique: true },
    { key: { slug: 1 } },
  ]);
  return collection;
}

export async function toggleVote(userId: string, slug: string): Promise<boolean> {
  const collection = await getVotesCollection();
  const existing = await collection.findOne({ userId, slug });
  const { db } = await connectToDatabase();
  const components = db.collection("components");

  if (existing) {
    await collection.deleteOne({ userId, slug });
    await components.updateOne({ slug, likes: { $gt: 0 } }, { $inc: { likes: -1 } });
    return false;
  }

  await collection.insertOne({ userId, slug, createdAt: new Date() });
  await components.updateOne({ slug }, { $inc: { likes: 1 } });
  return true;
}

export async function countVotes(slug: string): Promise<number> {
  const collection = await getVotesCollection();
  return collection.countDocuments({ slug });
}

export async function getVoterIds(slug: string): Promise<string[]> {
  const collection = await getVotesCollection();
  const rows = await collection.find({ slug }).project<{ userId: string }>({ userId: 1 }).toArray();
  return rows.map((row) => row.userId);
}

/* -------------------------------------------------------------------------- */
/*                              Collections                                  */
/* -------------------------------------------------------------------------- */

export type CollectionDocument = {
  _id?: ObjectId;
  slug: string;
  title: string;
  description: string;
  componentSlugs: string[];
  curatorId: string;
  curatorName: string;
  featured: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export async function getCollectionsCollection(): Promise<Collection<CollectionDocument>> {
  const { db } = await connectToDatabase();
  const collection = db.collection<CollectionDocument>("collections");
  await collection.createIndexes([
    { key: { slug: 1 }, unique: true },
    { key: { featured: 1, createdAt: -1 } },
  ]);
  return collection;
}

export async function listCollections(): Promise<CollectionDocument[]> {
  const collection = await getCollectionsCollection();
  return collection.find().sort({ featured: -1, createdAt: -1 }).limit(50).toArray();
}

export async function getCollection(slug: string): Promise<CollectionDocument | null> {
  const collection = await getCollectionsCollection();
  return collection.findOne({ slug });
}

export async function createCollection(input: {
  title: string;
  description: string;
  curatorId: string;
  curatorName: string;
  componentSlugs?: string[];
  featured?: boolean;
}): Promise<CollectionDocument> {
  const collection = await getCollectionsCollection();
  const slug = input.title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const doc: CollectionDocument = {
    slug,
    title: input.title,
    description: input.description,
    componentSlugs: input.componentSlugs ?? [],
    curatorId: input.curatorId,
    curatorName: input.curatorName,
    featured: input.featured ?? false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await collection.insertOne(doc);
  return doc;
}

/**
 * Ensures the curated starter collections exist so the marketplace has
 * browsable shelves from first launch.
 */
export async function ensureStarterCollections(): Promise<void> {
  const collection = await getCollectionsCollection();
  const starters = [
    {
      slug: "essentials",
      title: "Essentials",
      description: "Small, dependable primitives you will reuse everywhere.",
      componentSlugs: [] as string[],
      curatorName: "Shadway",
      featured: true,
    },
    {
      slug: "marketing-blocks",
      title: "Marketing blocks",
      description: "Heroes, features, pricing and other landing page sections.",
      componentSlugs: [] as string[],
      curatorName: "Shadway",
      featured: true,
    },
    {
      slug: "animation",
      title: "Motion",
      description: "Components with purposeful motion and micro-interactions.",
      componentSlugs: [] as string[],
      curatorName: "Shadway",
      featured: false,
    },
  ];

  for (const starter of starters) {
    const exists = await collection.findOne({ slug: starter.slug });
    if (!exists) {
      await collection.insertOne({
        ...starter,
        curatorId: "shadway",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }
}