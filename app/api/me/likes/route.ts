import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserLikes } from "@/lib/db/marketplace";

export const runtime = "nodejs";

/**
 * The slugs the signed-in account has liked.
 *
 * Serves the feed's like state in one request. Anonymous visitors get an empty
 * list rather than a 401, because the feed still renders for them and a failed
 * fetch would otherwise look like a bug.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ slugs: [] });
    }

    const slugs = await getUserLikes(session.user.id);
    return NextResponse.json({ slugs });
  } catch (error) {
    console.error("Failed to read likes:", error);
    return NextResponse.json({ error: "Failed to read likes" }, { status: 500 });
  }
}
