import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  ensureBookmarked,
  removeBookmark,
  getUserBookmarks,
} from "@/lib/db/marketplace";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ slugs: [] });
    }
    return NextResponse.json({ slugs: await getUserBookmarks(session.user.id) });
  } catch (error) {
    console.error("Failed to read bookmarks:", error);
    return NextResponse.json({ error: "Failed to read bookmarks" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Sign in to save components" }, { status: 401 });
    }

    const { slug, action } = await request.json();
    if (!slug) {
      return NextResponse.json({ error: "slug is required" }, { status: 400 });
    }

    const saved = action === "remove" ? !(await removeBookmark(session.user.id, slug)) : await ensureBookmarked(session.user.id, slug);

    return NextResponse.json({ saved, slug });
  } catch (error) {
    console.error("Failed to update bookmark:", error);
    return NextResponse.json({ error: "Failed to update bookmark" }, { status: 500 });
  }
}