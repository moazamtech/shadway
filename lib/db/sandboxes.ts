import { connectToDatabase } from "@/lib/mongodb";

/**
 * The VM behind a draft.
 *
 * One sandbox per draft, keyed by (user, slug) — the CodeSandbox id pointed
 * at from here is what gets resumed every time the studio reopens, so the
 * dev server picks up exactly where the author left off.
 */

export type SandboxDocument = {
  userId: string;
  slug: string;
  codesandboxId: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
};

export async function getSandboxesCollection() {
  const { db } = await connectToDatabase();
  return db.collection<SandboxDocument>("sandboxes");
}

let indexesReady: Promise<void> | null = null;

function ensureSandboxIndexes(): Promise<void> {
  indexesReady ??= getSandboxesCollection()
    .then((collection) =>
      collection.createIndexes([{ key: { userId: 1, slug: 1 }, unique: true }])
    )
    .then(() => undefined)
    .catch(() => undefined);
  return indexesReady;
}

export async function findSandboxForDraft(userId: string, slug: string) {
  const collection = await getSandboxesCollection();
  return collection.findOne({ userId, slug });
}

export async function saveSandboxForDraft(input: {
  userId: string;
  slug: string;
  codesandboxId: string;
  title: string;
}) {
  await ensureSandboxIndexes();
  const collection = await getSandboxesCollection();
  const now = new Date();
  await collection.updateOne(
    { userId: input.userId, slug: input.slug },
    {
      $set: {
        codesandboxId: input.codesandboxId,
        title: input.title,
        updatedAt: now,
      },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true }
  );
}
