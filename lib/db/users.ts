import { connectToDatabase } from "@/lib/mongodb";
import {
  deriveHandleFromEmail,
  normalizeHandle,
} from "@/lib/handles";
import { ObjectId, type Collection } from "mongodb";

/**
 * Accounts, and the public profiles built from them.
 *
 * Components and bundles store a denormalized `author` record, so for the
 * seeded demo content a handle can exist without any user document behind it.
 * `resolveProfile` therefore falls back to that record — a profile URL that
 * once rendered must keep rendering.
 */
export type UserDocument = {
  _id?: ObjectId;
  email: string;
  password?: string;
  name?: string;
  username?: string;
  avatar?: string;
  bio?: string;
  website?: string;
  twitter?: string;
  github?: string;
  role?: string;
  createdAt?: Date;
  updatedAt?: Date;
};

export type PublicProfile = {
  /** The canonical handle the profile URL is built from. */
  handle: string;
  name: string;
  avatar?: string;
  bio?: string;
  website?: string;
  twitter?: string;
  github?: string;
  /** Only ever filled for the signed-in owner's own profile. */
  email?: string;
  role?: string;
  joinedAt?: Date;
  /** False when the page is showing a legacy author record with no account. */
  claimed: boolean;
};

export async function getUsersCollection(): Promise<Collection<UserDocument>> {
  const { db } = await connectToDatabase();
  const users = db.collection<UserDocument>("users");
  await users.createIndexes([{ key: { username: 1 }, sparse: true }]);
  return users;
}

/**
 * The account a session belongs to, and the collection to write back through.
 *
 * The `_id` lookup is the real one and the email lookup is the fallback: a
 * session minted before the id was carried on the token has only an email, and
 * an endpoint that hard-requires the id refuses exactly those people to change
 * their own settings. A raw string would silently match nothing here, because
 * `_id` is an ObjectId and `session.user.id` is its stringified form.
 *
 * This was a private helper inside `/api/me`; the profile endpoints need the
 * same lookup and the same fallback, and two copies of "how do we find the
 * person who is calling" is how one of them ends up updating the wrong record.
 */
export async function findAccountBySession(
  id: string,
  email?: string | null,
): Promise<{
  users: Collection<UserDocument>;
  account: UserDocument | null;
}> {
  const users = await getUsersCollection();

  if (ObjectId.isValid(id)) {
    const byId = await users.findOne({ _id: new ObjectId(id) });
    if (byId) return { users, account: byId };
  }
  if (email) {
    const byEmail = await users.findOne({ email });
    if (byEmail) return { users, account: byEmail };
  }
  return { users, account: null };
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Finds an account by its public handle.
 *
 * Accounts created before handles existed have only an email, so the email's
 * local part is accepted as a legacy alias. Both lookups are exact and
 * case-insensitive.
 */
export async function findUserByHandle(
  handle: string
): Promise<UserDocument | null> {
  const normalized = normalizeHandle(handle);
  if (!normalized) return null;

  const users = await getUsersCollection();
  const byUsername = await users.findOne({
    username: { $regex: `^${escapeRegex(normalized)}$`, $options: "i" },
  });
  if (byUsername) return byUsername;

  const emailPrefix = new RegExp(`^${escapeRegex(normalized)}@[^@]+$`, "i");
  return users.findOne({ email: emailPrefix });
}

/**
 * The handle a not-yet-named account should take, avoiding collisions.
 * `ignoreEmail` keeps the caller's own current handle in play, so re-running
 * this for an account that already owns one is a no-op.
 */
async function allocateHandle(
  users: Collection<UserDocument>,
  email: string,
  name?: string,
  ignoreEmail?: string
): Promise<string> {
  const base = deriveHandleFromEmail(email, name);
  const root = base.length >= 3 ? base : `creator-${normalizeHandle(email).slice(0, 18)}`;

  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate =
      attempt === 0 ? root : `${root.slice(0, 26)}-${attempt + 1}`;
    const clash = await users.findOne(
      {
        username: { $regex: `^${escapeRegex(candidate)}$`, $options: "i" },
        ...(ignoreEmail ? { email: { $ne: ignoreEmail } } : {}),
      },
      { projection: { _id: 1 } }
    );
    if (!clash) return candidate;
  }

  return `${root.slice(0, 20)}-${Date.now().toString(36)}`;
}

/** The unique handle an account would get, without writing anything. */
export async function planUsername(
  email: string,
  name?: string
): Promise<string> {
  const users = await getUsersCollection();
  return allocateHandle(users, email, name);
}

/**
 * Returns the account's handle, minting and persisting one on first call if
 * the document predates handles. Called from the owner's own pages and from
 * the publish path, so a legacy account self-heals the first time either is
 * used.
 */
export async function ensureUsername(email: string): Promise<string | null> {
  const users = await getUsersCollection();
  const user = await users.findOne({ email });
  if (!user) return null;
  if (user.username && normalizeHandle(user.username) === user.username) {
    return user.username;
  }

  const username = await allocateHandle(users, email, user.name, email);
  await users.updateOne(
    { _id: user._id },
    { $set: { username, updatedAt: new Date() } }
  );
  return username;
}

function fallbackName(handle: string, email?: string): string {
  const raw = email ? email.split("@")[0] : handle;
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

/**
 * Everything a profile page needs, from the account when it exists and from
 * the denormalized author record when it does not.
 */
export async function resolveProfile(
  handle: string
): Promise<PublicProfile | null> {
  const normalized = normalizeHandle(handle);
  if (!normalized) return null;

  const user = await findUserByHandle(normalized);
  if (user) {
    return {
      handle: user.username ?? normalized,
      name: user.name || fallbackName(normalized, user.email),
      avatar: user.avatar,
      bio: user.bio,
      website: user.website,
      twitter: user.twitter,
      github: user.github,
      email: user.email,
      role: user.role,
      joinedAt: user.createdAt,
      claimed: true,
    };
  }

  return legacyAuthorProfile(normalized);
}

/**
 * Last resort for the seeded content: the author object embedded in the
 * published items themselves. Without this, `/u/shadway` would 404 even
 * though its components are live on the feed.
 */
async function legacyAuthorProfile(
  handle: string
): Promise<PublicProfile | null> {
  const { db } = await connectToDatabase();

  const [component, bundle] = await Promise.all([
    db
      .collection("components")
      .find(
        { "author.username": handle, status: "published", visibility: "public" },
        { projection: { author: 1, createdAt: 1 } }
      )
      .sort({ createdAt: 1 })
      .limit(1)
      .next(),
    db
      .collection("bundles")
      .find({ "author.username": handle }, { projection: { author: 1, createdAt: 1 } })
      .sort({ createdAt: 1 })
      .limit(1)
      .next(),
  ]);

  const row = component ?? bundle;
  if (!row) return null;

  const author = row.author as
    | { name?: string; username?: string; avatar?: string | null }
    | undefined;

  return {
    handle,
    name: author?.name || handle,
    avatar: author?.avatar ?? undefined,
    joinedAt: (row as { createdAt?: Date }).createdAt,
    claimed: false,
  };
}
