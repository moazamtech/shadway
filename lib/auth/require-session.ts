import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
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

/** Resolves the author's public profile from the users collection. */
export async function resolveAuthor(session: {
  user: { id: string; email: string; name: string; role: string };
}) {
  const { db } = await connectToDatabase();
  const user = await db.collection<DbUser>("users").findOne({ _id: session.user.id });

  const username =
    (user as { username?: string } | null)?.username ||
    session.user.email?.split("@")[0] ||
    "author";

  return {
    userId: session.user.id,
    name: session.user.name || user?.name || username,
    username,
    avatar: (user as { image?: string } | null)?.image,
    role: session.user.role,
  };
}