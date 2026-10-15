import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  listCollections,
  createCollection,
  ensureStarterCollections,
} from "@/lib/db/marketplace";

export const runtime = "nodejs";

export async function GET() {
  try {
    await ensureStarterCollections();
    return NextResponse.json({ items: await listCollections() });
  } catch (error) {
    console.error("Failed to list collections:", error);
    return NextResponse.json({ error: "Failed to list collections" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Sign in to create collections" }, { status: 401 });
    }

    const { title, description, componentSlugs } = await request.json();
    if (!title?.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const item = await createCollection({
      title: String(title).trim(),
      description: String(description || ""),
      curatorId: session.user.id,
      curatorName: session.user.name || session.user.email || "Anonymous",
      componentSlugs: Array.isArray(componentSlugs) ? componentSlugs : [],
    });

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    console.error("Failed to create collection:", error);
    return NextResponse.json({ error: "Failed to create collection" }, { status: 500 });
  }
}