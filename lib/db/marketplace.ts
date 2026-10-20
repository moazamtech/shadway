import { randomBytes } from "node:crypto";
import { and, asc, count, desc, eq, gt, inArray, sql } from "drizzle-orm";

import { db } from "./postgres";
import {
  collections,
  componentBookmarks,
  componentVotes,
  components,
} from "./schema";

/**
 * Bookmarks, votes and collections.
 *
 * The rows are the truth and the counters on the component document are a
 * copy. The feed draws thirty cards without thirty counts, and that is worth
 * the copy — but a copy is a copy, so it only moves when the row it counts
 * was really written. A counter that drifts above the rows behind it is worse
 * than no counter at all, because the feed would render a number nobody can
 * explain.
 */

/* -------------------------------------------------------------------------- */
/*                              Bookmarks                                    */
/* -------------------------------------------------------------------------- */

/**
 * A saved component.
 *
 * There is no id of its own. A bookmark is the pair of the account and the
 * slug, and that pair is the primary key, so two rows for the same pair would
 * be the same bookmark written twice.
 */
export type BookmarkDocument = {
  userId: string;
  slug: string;
  createdAt: Date;
};

/**
 * The bookmarks table.
 *
 * The indexes live in the schema, so there is nothing to build here. Mongo
 * wanted them created at runtime because a stray write can bring a collection
 * into existence with no index on it; a table either exists with its
 * constraints or it does not exist at all.
 *
 * The call to `db()` is not decoration. A missing `DATABASE_URL` has to throw
 * from here, the way a missing `MONGODB_URI` threw from the Mongo connection,
 * because the callers catch that error and answer with a degraded response
 * rather than a crash.
 */
export async function getBookmarksCollection(): Promise<
  typeof componentBookmarks
> {
  db();
  return componentBookmarks;
}

/**
 * Save a component for an account, once.
 *
 * The insert gives way to a row that is already there, so saving the same
 * component twice is a no-op and the counter moves exactly once. It is the
 * duplicate that matters: a button that can be pressed twice would otherwise
 * count the same save twice, and the count is what the profile and the card
 * badge show.
 */
export async function ensureBookmarked(
  userId: string,
  slug: string,
): Promise<boolean> {
  const client = db();

  const inserted = await client
    .insert(componentBookmarks)
    .values({ userId, slug, createdAt: new Date() })
    .onConflictDoNothing({
      target: [componentBookmarks.userId, componentBookmarks.slug],
    })
    .returning({ userId: componentBookmarks.userId });

  if (inserted.length > 0) {
    await client
      .update(components)
      .set({ bookmarks: sql`${components.bookmarks} + 1` })
      .where(eq(components.slug, slug));
  }

  return inserted.length > 0;
}

/**
 * Unsave a component.
 *
 * The decrement is guarded by the counter being positive, in the same
 * statement that does the decrement. Reading the counter and then writing it
 * would let two removals at once take it below zero, and a negative bookmark
 * count is a number the feed would happily show next to the save button.
 */
export async function removeBookmark(
  userId: string,
  slug: string,
): Promise<boolean> {
  const client = db();

  const deleted = await client
    .delete(componentBookmarks)
    .where(
      and(
        eq(componentBookmarks.userId, userId),
        eq(componentBookmarks.slug, slug),
      ),
    )
    .returning({ slug: componentBookmarks.slug });

  if (deleted.length > 0) {
    await client
      .update(components)
      .set({ bookmarks: sql`${components.bookmarks} - 1` })
      .where(and(eq(components.slug, slug), gt(components.bookmarks, 0)));
  }

  return deleted.length > 0;
}

/**
 * The components an account has saved, most recent first.
 */
export async function getUserBookmarks(userId: string): Promise<string[]> {
  const client = db();
  const rows = await client
    .select({ slug: componentBookmarks.slug })
    .from(componentBookmarks)
    .where(eq(componentBookmarks.userId, userId))
    .orderBy(desc(componentBookmarks.createdAt));

  return rows.map((row) => row.slug);
}

/**
 * How many accounts saved a component.
 *
 * Counted from the rows rather than read off the counter, because this is the
 * number that has to be right: it is what the counter is checked against.
 */
export async function countBookmarks(slug: string): Promise<number> {
  const client = db();
  const [row] = await client
    .select({ value: count() })
    .from(componentBookmarks)
    .where(eq(componentBookmarks.slug, slug));

  return row?.value ?? 0;
}

/* -------------------------------------------------------------------------- */
/*                                 Votes                                      */
/* -------------------------------------------------------------------------- */

/**
 * A vote on a component.
 *
 * Like a bookmark, the vote is the pair of the account and the slug, and that
 * pair is the key. There is no row id, because there is no row to point at:
 * one account's vote on one component is one thing.
 */
export type VoteDocument = {
  userId: string;
  slug: string;
  createdAt: Date;
};

/**
 * The votes table.
 *
 * Same reasoning as the bookmarks: the indexes belong to the schema, and the
 * connection has to be opened here so a missing configuration throws where
 * the callers can see it.
 */
export async function getVotesCollection(): Promise<typeof componentVotes> {
  db();
  return componentVotes;
}

/**
 * Toggle the legacy anonymous vote.
 *
 * The vote is keyed on a forwarded address rather than an account, so this is
 * the path that counted every visitor behind one NAT address as a single
 * voter. It is kept because the route still answers it, and it writes the
 * same rows as the account path — one table, two ways in.
 *
 * The insert gives way to a row that is already there, so a vote that arrives
 * twice is one vote. When that happens the row is there anyway, which means
 * the vote is on and somebody else has already moved the counter.
 */
export async function toggleVote(userId: string, slug: string): Promise<boolean> {
  const client = db();

  const existing = await client
    .select({ userId: componentVotes.userId })
    .from(componentVotes)
    .where(
      and(eq(componentVotes.userId, userId), eq(componentVotes.slug, slug)),
    )
    .limit(1);

  if (existing.length > 0) {
    await client
      .delete(componentVotes)
      .where(
        and(eq(componentVotes.userId, userId), eq(componentVotes.slug, slug)),
      );
    await client
      .update(components)
      .set({ likes: sql`${components.likes} - 1` })
      .where(and(eq(components.slug, slug), gt(components.likes, 0)));
    return false;
  }

  const inserted = await client
    .insert(componentVotes)
    .values({ userId, slug, createdAt: new Date() })
    .onConflictDoNothing({
      target: [componentVotes.userId, componentVotes.slug],
    })
    .returning({ userId: componentVotes.userId });

  if (inserted.length === 0) {
    // The vote was written between the read and the write. It is on, and the
    // counter has been moved by whoever wrote it, so there is nothing to add.
    return true;
  }

  await client
    .update(components)
    .set({ likes: sql`${components.likes} + 1` })
    .where(eq(components.slug, slug));

  return true;
}

/**
 * How many votes a component has.
 */
export async function countVotes(slug: string): Promise<number> {
  const client = db();
  const [row] = await client
    .select({ value: count() })
    .from(componentVotes)
    .where(eq(componentVotes.slug, slug));

  return row?.value ?? 0;
}

/**
 * Who voted for a component.
 */
export async function getVoterIds(slug: string): Promise<string[]> {
  const client = db();
  const rows = await client
    .select({ userId: componentVotes.userId })
    .from(componentVotes)
    .where(eq(componentVotes.slug, slug));

  return rows.map((row) => row.userId);
}

/* -------------------------------------------------------------------------- */
/*                            Per-account likes                              */
/* -------------------------------------------------------------------------- */

/**
 * Whether a given account has liked a component.
 *
 * The like is keyed on the signed-in account id, so it survives sessions and
 * devices — unlike the legacy `toggleVote` path, which keyed on an anonymous
 * `x-forwarded-for` value and therefore counted every visitor behind one NAT
 * address as the same voter.
 */
export async function getLikeState(
  userId: string,
  slug: string,
): Promise<boolean> {
  const client = db();
  const rows = await client
    .select({ userId: componentVotes.userId })
    .from(componentVotes)
    .where(
      and(eq(componentVotes.userId, userId), eq(componentVotes.slug, slug)),
    )
    .limit(1);

  return rows.length > 0;
}

/**
 * Toggle a like for a signed-in account.
 *
 * Returns the resulting state. The denormalised `likes` counter on the
 * component is kept in step here so the feed can sort and render without a
 * count on every card — at 100k users that per-card count would be the thing
 * that kills the feed.
 *
 * The counter moves only when a row was really written. The old upsert moved
 * it whatever the upsert did, so two likes arriving together left the
 * counter one ahead of the rows, and the rows are the truth.
 */
export async function toggleLike(
  userId: string,
  slug: string,
): Promise<boolean> {
  const client = db();

  const existing = await client
    .select({ userId: componentVotes.userId })
    .from(componentVotes)
    .where(
      and(eq(componentVotes.userId, userId), eq(componentVotes.slug, slug)),
    )
    .limit(1);

  if (existing.length > 0) {
    await client
      .delete(componentVotes)
      .where(
        and(eq(componentVotes.userId, userId), eq(componentVotes.slug, slug)),
      );
    await client
      .update(components)
      .set({ likes: sql`${components.likes} - 1` })
      .where(and(eq(components.slug, slug), gt(components.likes, 0)));
    return false;
  }

  const inserted = await client
    .insert(componentVotes)
    .values({ userId, slug, createdAt: new Date() })
    .onConflictDoNothing({
      target: [componentVotes.userId, componentVotes.slug],
    })
    .returning({ userId: componentVotes.userId });

  if (inserted.length === 0) {
    // The like was written between the read and the write. It is on, and the
    // counter has been moved by whoever wrote it, so there is nothing to add.
    return true;
  }

  await client
    .update(components)
    .set({ likes: sql`${components.likes} + 1` })
    .where(eq(components.slug, slug));

  return true;
}

/**
 * The components a signed-in account has liked.
 *
 * Kept for the "liked" filter and for the profile's saved tab. The order is
 * the slug, because that is the order the old query answered in: it read the
 * index on the account and the slug.
 */
export async function getUserLikes(userId: string): Promise<string[]> {
  const client = db();
  const rows = await client
    .select({ slug: componentVotes.slug })
    .from(componentVotes)
    .where(eq(componentVotes.userId, userId))
    .orderBy(asc(componentVotes.slug));

  return rows.map((row) => row.slug);
}

/**
 * Like states for a batch of slugs, in one query.
 *
 * The feed renders up to 48 cards at once; asking the database once per card
 * would be an N+1. One query and a lookup instead.
 */
export async function getLikeStates(
  userId: string,
  slugs: string[],
): Promise<Record<string, boolean>> {
  if (!slugs.length) return {};

  const client = db();
  const rows = await client
    .select({ slug: componentVotes.slug })
    .from(componentVotes)
    .where(
      and(
        eq(componentVotes.userId, userId),
        inArray(componentVotes.slug, slugs),
      ),
    );

  const map: Record<string, boolean> = {};
  for (const row of rows) map[row.slug] = true;
  return map;
}

/**
 * Like counts for a batch of slugs.
 *
 * Read from the denormalised counter rather than counted, so a page of cards
 * costs one query instead of one per card.
 */
export async function getLikeCounts(
  slugs: string[],
): Promise<Record<string, number>> {
  if (!slugs.length) return {};

  const client = db();
  const rows = await client
    .select({ slug: components.slug, likes: components.likes })
    .from(components)
    .where(inArray(components.slug, slugs));

  const map: Record<string, number> = {};
  for (const row of rows) map[row.slug] = row.likes ?? 0;
  return map;
}

/* -------------------------------------------------------------------------- */
/*                              Collections                                  */
/* -------------------------------------------------------------------------- */

/**
 * A curated shelf of components.
 *
 * The `_id` is the string the ObjectId was, because the ids were copied over
 * as they were and something reading a collection should not be able to tell
 * which database it came from.
 */
export type CollectionDocument = {
  _id?: string;
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

type CollectionRow = typeof collections.$inferSelect;

/**
 * The collections table.
 *
 * Same reasoning as the other two: the unique index on the slug belongs to
 * the schema, and the connection has to be opened here so a missing
 * configuration throws where the callers can see it.
 */
export async function getCollectionsCollection(): Promise<typeof collections> {
  db();
  return collections;
}

/**
 * A row as a document.
 *
 * The optional columns are filled in rather than left out. A collection
 * without a description reads as a collection without a description, and the
 * page that shows them would render an empty gap where the sentence goes.
 */
function toCollectionDocument(row: CollectionRow): CollectionDocument {
  return {
    _id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description ?? "",
    componentSlugs: row.componentSlugs ?? [],
    curatorId: row.curatorId ?? "",
    curatorName: row.curatorName ?? "",
    featured: row.featured,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * A fresh id for a row that needs one.
 *
 * Twenty-four hex characters, the shape the ids already in the table have, so
 * a new row is not the only one in the database that looks different.
 */
function newId(): string {
  return randomBytes(12).toString("hex");
}

/**
 * The shelves, the featured ones first.
 */
export async function listCollections(): Promise<CollectionDocument[]> {
  const client = db();
  const rows = await client
    .select()
    .from(collections)
    .orderBy(desc(collections.featured), desc(collections.createdAt))
    .limit(50);

  return rows.map(toCollectionDocument);
}

/**
 * One shelf, by its slug.
 */
export async function getCollection(
  slug: string,
): Promise<CollectionDocument | null> {
  const client = db();
  const rows = await client
    .select()
    .from(collections)
    .where(eq(collections.slug, slug))
    .limit(1);

  const row = rows[0];
  return row ? toCollectionDocument(row) : null;
}

/**
 * Create a shelf.
 *
 * The slug comes from the title, so two shelves with the same title want the
 * same address — and the unique index on the slug says so, out loud, rather
 * than letting the second one quietly replace the first.
 */
export async function createCollection(input: {
  title: string;
  description: string;
  curatorId: string;
  curatorName: string;
  componentSlugs?: string[];
  featured?: boolean;
}): Promise<CollectionDocument> {
  const client = db();
  const slug = input.title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const now = new Date();
  const id = newId();

  const doc: CollectionDocument = {
    _id: id,
    slug,
    title: input.title,
    description: input.description,
    componentSlugs: input.componentSlugs ?? [],
    curatorId: input.curatorId,
    curatorName: input.curatorName,
    featured: input.featured ?? false,
    createdAt: now,
    updatedAt: now,
  };

  await client.insert(collections).values({
    id,
    slug: doc.slug,
    title: doc.title,
    description: doc.description,
    componentSlugs: doc.componentSlugs,
    curatorId: doc.curatorId,
    curatorName: doc.curatorName,
    featured: doc.featured,
    createdAt: now,
    updatedAt: now,
  });

  return doc;
}

/**
 * Ensures the curated starter collections exist so the marketplace has
 * browsable shelves from first launch.
 *
 * One statement instead of a find and an insert per starter on every request,
 * and the conflict is ignored rather than raised, which is what makes two
 * first requests at the same moment safe: the second one finds the shelves
 * the first one wrote and leaves them alone.
 */
export async function ensureStarterCollections(): Promise<void> {
  const client = db();
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

  const now = new Date();

  await client
    .insert(collections)
    .values(
      starters.map((starter) => ({
        id: newId(),
        slug: starter.slug,
        title: starter.title,
        description: starter.description,
        componentSlugs: starter.componentSlugs,
        curatorId: "shadway",
        curatorName: starter.curatorName,
        featured: starter.featured,
        createdAt: now,
        updatedAt: now,
      })),
    )
    .onConflictDoNothing({ target: collections.slug });
}
