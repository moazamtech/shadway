import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { sessionAvatar, sessionDisplayName, sessionUsername } from "@/lib/session";
import { ensureUsername } from "@/lib/db/users";
import { User as DbUser } from "@/lib/types";

/**
 * Session gate for the marketplace.
 *
 * Publishing requires a signed-in account so every component has a real
 * owner, and owners can edit/unpublish their work later.
 */
export async function requireSession() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return {
      session: null,
      response: NextResponse.json(
        { error: "Sign in to publish components" },
        { status: 401 }
      ),
    };
  }

  return { session, response: null };
}

/** Resolves the author's public profile for a publish. */
export async function resolveAuthor(session: Session) {
  const { db } = await connectToDatabase();

  // Prefer the handle stored on the account — that is the name its profile
  // page lives at, and `ComponentAuthor.username` is what
  // `listComponents({ author })` filters on. Accounts created before handles
  // existed get one minted here (the same way their profile page would), so
  // a first publish and a first profile visit can never disagree about who
  // the author is.
  let username: string | null = null;
  const email = session.user?.email;
  if (email) {
    username = await ensureUsername(email).catch(() => null);
  }
  username = username ?? sessionUsername(session);

  // The display name is read live from the database: a name changed in
  // settings should land on the next publish even while the token still
  // carries the old copy.
  let name: string | undefined;
  const id = session.user?.id;
  if (id && ObjectId.isValid(id)) {
    type StoredUser = Omit<DbUser, "_id"> & { _id?: ObjectId };
    // A raw string here would silently match nothing, since `_id` is an
    // ObjectId and `session.user.id` is its stringified form.
    const stored = await db
      .collection<StoredUser>("users")
      .findOne({ _id: new ObjectId(id) });
    name = stored?.name ?? undefined;
  }

  return {
    userId: id ?? "",
    name: name || sessionDisplayName(session) || username,
    username,
    avatar: sessionAvatar(session),
    role: session.user?.role || "user",
  };
}