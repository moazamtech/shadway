import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";

import { deriveHandleFromEmail, normalizeHandle } from "@/lib/handles";

import { db } from "./postgres";
import { components, users as usersTable } from "./schema";

/**
 * Accounts, and the public profiles built from them.
 *
 * Components store a denormalized `author` record, so for the seeded demo
 * content a handle can exist without any user document behind it.
 * `resolveProfile` therefore falls back to that record — a profile URL that
 * once rendered must keep rendering.
 */
export type UserDocument = {
  /**
   * The row's id, as text.
   *
   * It was an `ObjectId` and the migration carried the same twenty-four
   * characters over, so a lookup compares the string the session carries
   * instead of building an object id out of it. Everything that stringifies it
   * still gets the value it got before.
   */
  _id?: string;
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

/**
 * The write side of the accounts table.
 *
 * The routes that change an account still ask for a collection and still speak
 * `$set` and `$unset`, because that is the vocabulary they were written
 * against and because "put this here" and "take that away" are two different
 * intentions that a single flat object cannot express. This is that handle,
 * pointed at a table.
 */
export type UserCollection = {
  updateOne(
    filter: { _id?: string },
    update: { $set?: Record<string, unknown>; $unset?: Record<string, string> },
  ): Promise<unknown>;
};

/** The connected database, as the client hands it back. */
type Database = ReturnType<typeof db>;

/** The columns that may be empty, and so may be cleared. */
type NullableField =
  | "name"
  | "username"
  | "avatar"
  | "bio"
  | "website"
  | "twitter"
  | "github";

/**
 * The columns a write may touch.
 *
 * A row is a fixed set of columns, so a write is too. Anything else the
 * caller sends is dropped rather than stored in a column that does not exist —
 * a field nobody reads is not worth a column, and a field that *is* read has
 * to be a column the database can enforce.
 */
type UserPatch = {
  email?: string;
  password?: string;
  name?: string | null;
  username?: string | null;
  avatar?: string | null;
  bio?: string | null;
  website?: string | null;
  twitter?: string | null;
  github?: string | null;
  role?: string;
  createdAt?: Date;
  updatedAt?: Date;
};

/**
 * One text column: the value it is given, or null to clear it.
 *
 * A column nobody mentions is left alone. A column mentioned with nothing in
 * it is cleared, because that is what an empty value means to the routes that
 * send one — the same thing an unset meant when the field was removed from the
 * document.
 */
function textColumn(
  set: Record<string, unknown>,
  cleared: ReadonlySet<string>,
  field: NullableField,
): string | null | undefined {
  if (Object.prototype.hasOwnProperty.call(set, field)) {
    const value = set[field];
    return typeof value === "string" ? value : null;
  }
  if (cleared.has(field)) return null;
  return undefined;
}

function buildPatch(update: {
  $set?: Record<string, unknown>;
  $unset?: Record<string, string>;
}): UserPatch {
  const set = update.$set ?? {};
  const cleared = new Set(Object.keys(update.$unset ?? {}));

  const patch: UserPatch = {
    name: textColumn(set, cleared, "name"),
    username: textColumn(set, cleared, "username"),
    avatar: textColumn(set, cleared, "avatar"),
    bio: textColumn(set, cleared, "bio"),
    website: textColumn(set, cleared, "website"),
    twitter: textColumn(set, cleared, "twitter"),
    github: textColumn(set, cleared, "github"),
  };

  if (typeof set.email === "string") patch.email = set.email;
  if (typeof set.password === "string") patch.password = set.password;
  if (typeof set.role === "string") patch.role = set.role;
  if (set.createdAt instanceof Date) patch.createdAt = set.createdAt;
  if (set.updatedAt instanceof Date) patch.updatedAt = set.updatedAt;

  return patch;
}

/**
 * The row as the document callers expect.
 *
 * An absent column is `undefined` here and not `null`, because the callers
 * ask "is there a bio" and a `null` answers that question differently from a
 * missing field. The document this replaces had no such distinction.
 */
function toUserDocument(row: typeof usersTable.$inferSelect): UserDocument {
  return {
    _id: row.id,
    email: row.email,
    password: row.password,
    name: row.name ?? undefined,
    username: row.username ?? undefined,
    avatar: row.avatar ?? undefined,
    bio: row.bio ?? undefined,
    website: row.website ?? undefined,
    twitter: row.twitter ?? undefined,
    github: row.github ?? undefined,
    role: row.role,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** The handle the routes write through. */
function userCollection(client: Database): UserCollection {
  return {
    async updateOne(filter, update) {
      const id = filter._id;
      if (!id) return { matchedCount: 0, modifiedCount: 0 };

      const patch = buildPatch(update);
      const result = await client
        .update(usersTable)
        .set(patch)
        .where(eq(usersTable.id, id));

      const count = result.rowCount ?? 0;
      return { matchedCount: count, modifiedCount: count };
    },
  };
}

/**
 * The accounts table, and the handle to write through it.
 *
 * The Mongo version created a sparse index on the handle on every call; the
 * table carries a unique one on it already, and a unique index is a promise
 * the database keeps rather than one a request asks for.
 */
export async function getUsersCollection(): Promise<UserCollection> {
  return userCollection(db());
}

/**
 * The account a session belongs to, and the collection to write back through.
 *
 * The `_id` lookup is the real one and the email lookup is the fallback: a
 * session minted before the id was carried on the token has only an email, and
 * an endpoint that hard-requires the id refuses exactly those people to change
 * their own settings.
 *
 * The id is text now, so it is compared as text — a raw string that is not an
 * id matches nothing here rather than raising, and the email fallback answers
 * exactly as it did when the lookup had to decide whether the string was an
 * object id first.
 *
 * This was a private helper inside `/api/me`; the profile endpoints need the
 * same lookup and the same fallback, and two copies of "how do we find the
 * person who is calling" is how one of them ends up updating the wrong record.
 */
export async function findAccountBySession(
  id: string,
  email?: string | null,
): Promise<{
  users: UserCollection;
  account: UserDocument | null;
}> {
  const client = db();
  const users = await getUsersCollection();

  const byId = await client
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, id))
    .limit(1);
  if (byId[0]) return { users, account: toUserDocument(byId[0]) };

  if (email) {
    const byEmail = await client
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email))
      .limit(1);
    if (byEmail[0]) return { users, account: toUserDocument(byEmail[0]) };
  }
  return { users, account: null };
}

/**
 * An account, found by its email.
 *
 * The sign-in route asks this question, and so does the register route before
 * it writes: an address is either free or it is taken. The comparison folds
 * the case, because an address is stored the way it was typed and people type
 * `Ada@Example.com` as often as they type it in lower case.
 */
export async function findAccountByEmail(
  email: string,
): Promise<UserDocument | null> {
  const client = db();
  const rows = await client
    .select()
    .from(usersTable)
    .where(sql`lower(${usersTable.email}) = lower(${email})`)
    .limit(1);
  return rows[0] ? toUserDocument(rows[0]) : null;
}

/**
 * A new account.
 *
 * The id is minted here rather than by the caller, so every account in the
 * table has an id of the same kind — a text one, as the migration carried
 * over — and the routes that write accounts do not have to know how.
 */
export async function createAccount(values: {
  email: string;
  password: string;
  name?: string;
  username?: string;
  role?: string;
}): Promise<UserDocument> {
  const client = db();
  const now = new Date();
  const id = crypto.randomUUID();

  await client.insert(usersTable).values({
    id,
    email: values.email,
    password: values.password,
    name: values.name ?? null,
    username: values.username ?? null,
    role: values.role ?? "user",
    createdAt: now,
    updatedAt: now,
  });

  const rows = await client
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, id))
    .limit(1);

  return toUserDocument(rows[0]);
}

/**
 * The accounts an administrator may see.
 *
 * The password is not in the list and not in the answer: an administrator
 * manages accounts, and managing one does not mean reading its secret.
 */
export async function listAdminAccounts(): Promise<UserDocument[]> {
  const client = db();
  const rows = await client
    .select({
      id: usersTable.id,
      email: usersTable.email,
      name: usersTable.name,
      username: usersTable.username,
      avatar: usersTable.avatar,
      bio: usersTable.bio,
      website: usersTable.website,
      twitter: usersTable.twitter,
      github: usersTable.github,
      role: usersTable.role,
      createdAt: usersTable.createdAt,
      updatedAt: usersTable.updatedAt,
    })
    .from(usersTable)
    .where(eq(usersTable.role, "admin"))
    .orderBy(desc(usersTable.createdAt));

  return rows.map((row) => ({
    _id: row.id,
    email: row.email,
    name: row.name ?? undefined,
    username: row.username ?? undefined,
    avatar: row.avatar ?? undefined,
    bio: row.bio ?? undefined,
    website: row.website ?? undefined,
    twitter: row.twitter ?? undefined,
    github: row.github ?? undefined,
    role: row.role,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));
}

/** One account, without its password. */
export async function readAccount(id: string): Promise<UserDocument | null> {
  const client = db();
  const rows = await client
    .select({
      id: usersTable.id,
      email: usersTable.email,
      name: usersTable.name,
      username: usersTable.username,
      avatar: usersTable.avatar,
      bio: usersTable.bio,
      website: usersTable.website,
      twitter: usersTable.twitter,
      github: usersTable.github,
      role: usersTable.role,
      createdAt: usersTable.createdAt,
      updatedAt: usersTable.updatedAt,
    })
    .from(usersTable)
    .where(eq(usersTable.id, id))
    .limit(1);

  if (!rows[0]) return null;
  const row = rows[0];
  return {
    _id: row.id,
    email: row.email,
    name: row.name ?? undefined,
    username: row.username ?? undefined,
    avatar: row.avatar ?? undefined,
    bio: row.bio ?? undefined,
    website: row.website ?? undefined,
    twitter: row.twitter ?? undefined,
    github: row.github ?? undefined,
    role: row.role,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Change an account.
 *
 * The password is written when it is given and left alone when it is not, and
 * the answer never carries the secret back.
 */
export async function updateAccount(
  id: string,
  patch: { email?: string; name?: string; password?: string },
): Promise<UserDocument | null> {
  const client = db();
  const values: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.email !== undefined) values.email = patch.email;
  if (patch.name !== undefined) values.name = patch.name;
  if (patch.password !== undefined) values.password = patch.password;

  await client.update(usersTable).set(values).where(eq(usersTable.id, id));
  return readAccount(id);
}

/** Remove an account. */
export async function deleteAccount(id: string): Promise<boolean> {
  const client = db();
  const existing = await client
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.id, id))
    .limit(1);
  if (!existing.length) return false;

  await client.delete(usersTable).where(eq(usersTable.id, id));
  return true;
}

/**
 * The names of a set of accounts, by id.
 *
 * The payout ledger records who was paid, and the ledger's answer is a name
 * rather than an id: an administrator reading a list of addresses wants to see
 * whose address it is. Ids that match nobody are simply absent from the map,
 * because an account that has gone is still a row in the ledger.
 */
export async function usernamesFor(
  creatorIds: readonly string[],
): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  const ids = creatorIds.filter(Boolean);
  if (!ids.length) return names;

  const client = db();
  const rows = await client
    .select({
      id: usersTable.id,
      username: usersTable.username,
      name: usersTable.name,
      email: usersTable.email,
    })
    .from(usersTable)
    .where(inArray(usersTable.id, ids));

  for (const row of rows) {
    names.set(
      row.id,
      row.username || row.name || row.email || row.id,
    );
  }
  return names;
}

/**
 * A handle, compared the way the handle is meant to be read.
 *
 * Handles are lowercase by construction, but the column is not, and an
 * account that was typed as `Ada` still has to be found by `ada` — so the
 * comparison folds the case on both sides rather than trusting the stored
 * value to be tidy.
 */
function usernameIs(value: string) {
  return sql`lower(${usersTable.username}) = ${value}`;
}

/**
 * An email whose local part is this handle.
 *
 * The shape is the old one: one `@`, a local part that equals the handle, and
 * a domain with something in it. The domain is checked for emptiness because
 * `someone@` is not an address, and a local part alone is not one either, so
 * the count of `@` signs and the length of what follows it are both part of
 * the test.
 */
function emailLocalPartIs(value: string) {
  return sql`lower(split_part(${usersTable.email}, '@', 1)) = ${value}
    and length(${usersTable.email}) - length(replace(${usersTable.email}, '@', '')) = 1
    and length(${usersTable.email}) > position('@' in ${usersTable.email})`;
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

  const client = db();

  const byUsername = await client
    .select()
    .from(usersTable)
    .where(usernameIs(normalized))
    .limit(1);
  if (byUsername[0]) return toUserDocument(byUsername[0]);

  const byEmail = await client
    .select()
    .from(usersTable)
    .where(emailLocalPartIs(normalized))
    .limit(1);
  return byEmail[0] ? toUserDocument(byEmail[0]) : null;
}

/**
 * The handle a not-yet-named account should take, avoiding collisions.
 * `ignoreEmail` keeps the caller's own current handle in play, so re-running
 * this for an account that already owns one is a no-op.
 */
async function allocateHandle(
  client: Database,
  email: string,
  name?: string,
  ignoreEmail?: string
): Promise<string> {
  const base = deriveHandleFromEmail(email, name);
  const root = base.length >= 3 ? base : `creator-${normalizeHandle(email).slice(0, 18)}`;

  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate =
      attempt === 0 ? root : `${root.slice(0, 26)}-${attempt + 1}`;
    const clash = await client
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(
        and(
          usernameIs(candidate),
          ...(ignoreEmail ? [ne(usersTable.email, ignoreEmail)] : []),
        ),
      )
      .limit(1);
    if (!clash[0]) return candidate;
  }

  return `${root.slice(0, 20)}-${Date.now().toString(36)}`;
}

/** The unique handle an account would get, without writing anything. */
export async function planUsername(
  email: string,
  name?: string
): Promise<string> {
  return allocateHandle(db(), email, name);
}

/**
 * Returns the account's handle, minting and persisting one on first call if
 * the document predates handles. Called from the owner's own pages and from
 * the publish path, so a legacy account self-heals the first time either is
 * used.
 */
export async function ensureUsername(email: string): Promise<string | null> {
  const client = db();

  const rows = await client
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email))
    .limit(1);
  const user = rows[0];
  if (!user) return null;
  if (user.username && normalizeHandle(user.username) === user.username) {
    return user.username;
  }

  const username = await allocateHandle(
    client,
    email,
    user.name ?? undefined,
    email
  );
  await client
    .update(usersTable)
    .set({ username, updatedAt: new Date() })
    .where(eq(usersTable.id, user.id));
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
  const client = db();

  const rows = await client
    .select({ author: components.author, createdAt: components.createdAt })
    .from(components)
    .where(
      and(
        eq(components.status, "published"),
        eq(components.visibility, "public"),
        sql`${components.author}->>'username' = ${handle}`,
      ),
    )
    .orderBy(asc(components.createdAt))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  const author = row.author as
    | { name?: string; username?: string; avatar?: string | null }
    | undefined;

  return {
    handle,
    name: author?.name || handle,
    avatar: author?.avatar ?? undefined,
    joinedAt: row.createdAt,
    claimed: false,
  };
}
