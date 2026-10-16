import { NextResponse } from "next/server";
import type { Filter, Sort } from "mongodb";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getComponentsCollection,
  type ComponentDocument,
} from "@/lib/db/components";

export const runtime = "nodejs";

/**
 * The admin review queue: every component a user submitted for publishing.
 *
 * The flow is one-directional — user submits (status: "pending"), admin
 * approves ("published") or rejects ("hidden"). Approval outcomes go through
 * PATCH /api/components/[slug]; this endpoint only reads the queue.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const collection = await getComponentsCollection();

    // Oldest first: the queue drains in submission order.
    const filter: Filter<ComponentDocument> = { status: "pending" };
    const orderBy: Sort = { updatedAt: 1 };

    const items = await collection
      .find(filter)
      .sort(orderBy)
      .limit(200)
      .toArray();

    const reviewItems = items.map((item) => ({
      slug: item.slug,
      title: item.title,
      description: item.description ?? "",
      category: item.category,
      tags: item.tags ?? [],
      author: item.author,
      thumbnailUrl: item.thumbnailUrl,
      dependencies: item.dependencies ?? [],
      visibility: item.visibility,
      codeSize: item.code?.length ?? 0,
      hasDemo: Boolean(item.demoCode),
      fileCount: item.files?.length ?? 0,
      status: item.status,
      updatedAt: item.updatedAt ?? item.createdAt ?? null,
    }));

    return NextResponse.json({ items: reviewItems, count: reviewItems.length });
  } catch (error) {
    console.error("Failed to load review queue:", error);
    return NextResponse.json(
      { error: "Failed to load review queue" },
      { status: 500 }
    );
  }
}
